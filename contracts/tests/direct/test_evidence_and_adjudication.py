"""Direct-mode tests for evidence submission, adjudication (with mocked
web/LLM), and the payout/refund/slash claim paths. Direct mode runs only
the leader function — see test_validator_tolerance.py for the validator
comparison logic itself."""

import datetime
import json

CONTRACT_PATH = "contracts/veritine_contract.py"

def _hex(addr) -> str:
    """create_address() returns raw bytes in this harness (no genlayer.py.types
    available outside the WASM sandbox) - convert to a 0x-hex string for any
    contract method expecting an address string."""
    if isinstance(addr, (bytes, bytearray)):
        return "0x" + addr.hex()
    return addr

TWO_POSITIONS = json.dumps(["Yes", "No"])


def _deploy(direct_deploy, treasury):
    return direct_deploy(CONTRACT_PATH, _hex(treasury), 0, 0)


def _future_ts(direct_vm, offset_seconds: int) -> int:
    now = datetime.datetime.fromisoformat(direct_vm._datetime.replace("Z", "+00:00"))
    return int((now + datetime.timedelta(seconds=offset_seconds)).timestamp())


def _mock_strong_evidence(direct_vm):
    direct_vm.mock_web(r".*", {"status": 200, "body": "Official filing confirming the claim in full."})
    direct_vm.mock_llm(
        r".*evidence-quality adjudicator.*",
        json.dumps(
            {
                "outcome": "STRONGLY_SUPPORTED",
                "authenticity_status": "Verified against fetched content.",
                "authority_assessment": "Regulatory filing, high authority.",
                "relevance_assessment": "Directly on point.",
                "timeliness_assessment": "Current.",
                "claim_support_assessment": "Fully supports the claim.",
                "materiality_assessment": "Complete.",
                "misrepresentation_assessment": "Accurately represented by submitter.",
                "reasoning_summary": "The filing directly and verifiably confirms the claim.",
            }
        ),
    )


def _mock_fabricated_evidence(direct_vm):
    direct_vm.mock_web(r".*", {"status": 404, "body": ""})
    direct_vm.mock_llm(
        r".*evidence-quality adjudicator.*",
        json.dumps(
            {
                "outcome": "FABRICATED_OR_UNVERIFIABLE",
                "authenticity_status": "Could not verify — fetch failed.",
                "authority_assessment": "Unknown.",
                "relevance_assessment": "Cannot assess.",
                "timeliness_assessment": "Cannot assess.",
                "claim_support_assessment": "Cannot assess.",
                "materiality_assessment": "Cannot assess.",
                "misrepresentation_assessment": "Submitter's claim could not be verified.",
                "reasoning_summary": "The source could not be retrieved or verified to exist as described.",
            }
        ),
    )


def _setup_dispute_with_evidence(direct_vm, contract, creator, submitter, outcome_mock):
    direct_vm.sender = creator
    direct_vm.value = 0
    dispute_id = contract.create_dispute(
        "Did the report overstate results?",
        "",
        "media",
        TWO_POSITIONS,
        _future_ts(direct_vm, 100),
        _future_ts(direct_vm, 200),
        0,
        0,
    )

    direct_vm.sender = submitter
    direct_vm.value = 500
    outcome_mock(direct_vm)
    evidence_id = contract.submit_evidence(
        dispute_id,
        0,
        "https://example.com/report",
        "Official Report",
        "Example Publisher",
        "2026-01-01",
        "This report confirms the claim.",
        "OFFICIAL_REPORT",
    )
    return dispute_id, evidence_id


def test_submit_evidence_records_stake_and_metadata(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = _deploy(direct_deploy, direct_owner)
    dispute_id, evidence_id = _setup_dispute_with_evidence(
        direct_vm, contract, direct_alice, direct_bob, _mock_strong_evidence
    )

    evidence = contract.get_evidence(evidence_id)
    assert evidence["source_url"] == "https://example.com/report"
    assert evidence["total_stake_wei"] == 500
    assert evidence["adjudicated"] is False
    assert evidence["outcome"] == ""

    dispute = contract.get_dispute(dispute_id)
    assert dispute["evidence_count"] == 1


def test_submit_evidence_rejects_bad_url(direct_vm, direct_deploy, direct_owner, direct_alice):
    contract = _deploy(direct_deploy, direct_owner)
    direct_vm.sender = direct_alice
    direct_vm.value = 0
    dispute_id = contract.create_dispute(
        "Q", "", "other", TWO_POSITIONS, _future_ts(direct_vm, 100), _future_ts(direct_vm, 200), 0, 0
    )

    direct_vm.value = 100
    with direct_vm.expect_revert():
        contract.submit_evidence(
            dispute_id, 0, "not-a-url", "Title", "Pub", "", "Summary here", "OFFICIAL_REPORT"
        )


def test_submit_evidence_rejects_invalid_source_type(direct_vm, direct_deploy, direct_owner, direct_alice):
    contract = _deploy(direct_deploy, direct_owner)
    direct_vm.sender = direct_alice
    direct_vm.value = 0
    dispute_id = contract.create_dispute(
        "Q", "", "other", TWO_POSITIONS, _future_ts(direct_vm, 100), _future_ts(direct_vm, 200), 0, 0
    )

    direct_vm.value = 100
    with direct_vm.expect_revert():
        contract.submit_evidence(
            dispute_id, 0, "https://example.com/x", "Title", "Pub", "", "Summary here", "NOT_A_REAL_TYPE"
        )


def test_submit_evidence_rejects_after_evidence_deadline(direct_vm, direct_deploy, direct_owner, direct_alice):
    contract = _deploy(direct_deploy, direct_owner)
    direct_vm.sender = direct_alice
    direct_vm.value = 0
    dispute_id = contract.create_dispute(
        "Q", "", "other", TWO_POSITIONS, _future_ts(direct_vm, 100), _future_ts(direct_vm, 200), 0, 0
    )

    direct_vm.warp("2030-01-01T00:00:00Z")
    direct_vm.value = 100
    with direct_vm.expect_revert():
        contract.submit_evidence(
            dispute_id, 0, "https://example.com/x", "Title", "Pub", "", "Summary here", "OFFICIAL_REPORT"
        )


def test_request_adjudication_rejects_before_deadline(direct_vm, direct_deploy, direct_owner, direct_alice):
    contract = _deploy(direct_deploy, direct_owner)
    direct_vm.sender = direct_alice
    direct_vm.value = 0
    dispute_id = contract.create_dispute(
        "Q", "", "other", TWO_POSITIONS, _future_ts(direct_vm, 3600), _future_ts(direct_vm, 7200), 0, 0
    )

    with direct_vm.expect_revert():
        contract.request_adjudication(dispute_id)


def test_full_adjudication_flow_strong_evidence_wins(
    direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob, direct_charlie
):
    contract = _deploy(direct_deploy, direct_owner)
    dispute_id, evidence_id = _setup_dispute_with_evidence(
        direct_vm, contract, direct_alice, direct_bob, _mock_strong_evidence
    )

    # Alice (creator) already staked 0 on creation; have Charlie back position 1 (loses).
    direct_vm.sender = direct_charlie
    direct_vm.value = 1000
    contract.stake_position(dispute_id, 1)

    direct_vm.sender = direct_alice
    direct_vm.value = 1000
    contract.stake_position(dispute_id, 0)

    # Move past the evidence deadline and mock the final conclusion prompt too.
    direct_vm.warp("2030-01-01T00:00:00Z")
    direct_vm.mock_llm(
        r".*final adjudicator.*",
        json.dumps(
            {
                "conclusion": "POSITION_SUPPORTED",
                "winning_position_index": 0,
                "reasoning_summary": "The strongly-supported evidence clearly favors position 0.",
            }
        ),
    )

    result = contract.request_adjudication(dispute_id)
    assert result["status"] == "ADJUDICATED"
    assert result["conclusion"] == "POSITION_SUPPORTED"
    assert result["winning_position_index"] == 0

    evidence = contract.get_evidence(evidence_id)
    assert evidence["adjudicated"] is True
    assert evidence["outcome"] == "STRONGLY_SUPPORTED"
    assert evidence["slash_bps"] == 0
    assert evidence["reward_eligible"] is True

    # Winning position staker claims: principal + share of losing pool.
    direct_vm.sender = direct_alice
    payout = contract.claim_position(dispute_id, 0)
    assert payout > 1000  # got principal back plus a share of Charlie's losing stake

    # Losing position staker claims: gets 0 (no principal back).
    direct_vm.sender = direct_charlie
    losing_payout = contract.claim_position(dispute_id, 1)
    assert losing_payout == 0

    # Evidence submitter (strongly supported, reward-eligible) claims their share.
    direct_vm.sender = direct_bob
    evidence_payout = contract.claim_evidence(dispute_id if False else evidence_id)
    assert evidence_payout >= 500  # at least principal back, since 0% slash


def test_double_claim_is_rejected(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = _deploy(direct_deploy, direct_owner)
    dispute_id, evidence_id = _setup_dispute_with_evidence(
        direct_vm, contract, direct_alice, direct_bob, _mock_strong_evidence
    )

    direct_vm.warp("2030-01-01T00:00:00Z")
    direct_vm.mock_llm(
        r".*conclusion.*|.*Decide the overall conclusion.*",
        json.dumps(
            {"conclusion": "INCONCLUSIVE", "winning_position_index": None, "reasoning_summary": "Split."}
        ),
    )
    contract.request_adjudication(dispute_id)

    direct_vm.sender = direct_bob
    first = contract.claim_evidence(evidence_id)
    assert first > 0

    with direct_vm.expect_revert():
        contract.claim_evidence(evidence_id)


def test_fabricated_evidence_is_slashed_in_full(
    direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob
):
    contract = _deploy(direct_deploy, direct_owner)
    dispute_id, evidence_id = _setup_dispute_with_evidence(
        direct_vm, contract, direct_alice, direct_bob, _mock_fabricated_evidence
    )

    direct_vm.warp("2030-01-01T00:00:00Z")
    direct_vm.mock_llm(
        r".*final adjudicator.*",
        json.dumps(
            {
                "conclusion": "EVIDENCE_INSUFFICIENT",
                "winning_position_index": None,
                "reasoning_summary": "No credible evidence was submitted.",
            }
        ),
    )
    contract.request_adjudication(dispute_id)

    evidence = contract.get_evidence(evidence_id)
    assert evidence["outcome"] == "FABRICATED_OR_UNVERIFIABLE"
    assert evidence["slash_bps"] == 10000
    assert evidence["reward_eligible"] is False

    direct_vm.sender = direct_bob
    payout = contract.claim_evidence(evidence_id)
    assert payout == 0  # fully slashed


def test_cancelled_dispute_refunds_position_stake_in_full(
    direct_vm, direct_deploy, direct_owner, direct_alice
):
    contract = _deploy(direct_deploy, direct_owner)
    direct_vm.sender = direct_alice
    direct_vm.value = 777
    dispute_id = contract.create_dispute(
        "Q", "", "other", TWO_POSITIONS, _future_ts(direct_vm, 3600), _future_ts(direct_vm, 7200), 0, 0
    )
    contract.cancel_dispute(dispute_id)

    payout = contract.claim_position(dispute_id, 0)
    assert payout == 777


def test_adjudication_timeout_allows_full_refund(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = _deploy(direct_deploy, direct_owner)
    direct_vm.sender = direct_alice
    direct_vm.value = 1000
    dispute_id = contract.create_dispute(
        "Q", "", "other", TWO_POSITIONS, _future_ts(direct_vm, 100), _future_ts(direct_vm, 200), 0, 0
    )

    direct_vm.sender = direct_bob
    direct_vm.value = 500
    contract.stake_position(dispute_id, 1)

    # Warp far past evidence_deadline + the adjudication timeout window
    # without ever calling request_adjudication — this is the abandoned/
    # stuck-fund recovery path.
    direct_vm.warp("2031-01-01T00:00:00Z")

    direct_vm.sender = direct_alice
    payout_alice = contract.claim_position(dispute_id, 0)
    assert payout_alice == 1000

    direct_vm.sender = direct_bob
    payout_bob = contract.claim_position(dispute_id, 1)
    assert payout_bob == 500

    assert contract.get_dispute(dispute_id)["status"] == "INVALID"


def test_withdraw_moves_credited_balance(direct_vm, direct_deploy, direct_owner, direct_alice):
    contract = _deploy(direct_deploy, direct_owner)
    direct_vm.sender = direct_alice
    direct_vm.value = 100
    dispute_id = contract.create_dispute(
        "Q", "", "other", TWO_POSITIONS, _future_ts(direct_vm, 3600), _future_ts(direct_vm, 7200), 0, 0
    )
    contract.cancel_dispute(dispute_id)
    contract.claim_position(dispute_id, 0)

    balance = contract.get_balance_of(_hex(direct_alice))
    assert balance == 100

    contract.withdraw(100)
    assert contract.get_balance_of(_hex(direct_alice)) == 0


def test_withdraw_rejects_insufficient_balance(direct_vm, direct_deploy, direct_owner, direct_alice):
    contract = _deploy(direct_deploy, direct_owner)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert():
        contract.withdraw(1)
