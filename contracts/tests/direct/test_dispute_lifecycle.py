"""Direct-mode tests for dispute creation, position staking, cancellation,
access control, and validation. No web/LLM mocking needed here — these
exercise only the deterministic paths."""

import json

import pytest

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
    import datetime

    now = datetime.datetime.fromisoformat(direct_vm._datetime.replace("Z", "+00:00"))
    return int((now + datetime.timedelta(seconds=offset_seconds)).timestamp())


def test_create_dispute_without_initial_stake(direct_vm, direct_deploy, direct_owner, direct_alice):
    contract = _deploy(direct_deploy, direct_owner)
    direct_vm.sender = direct_alice
    direct_vm.value = 0

    dispute_id = contract.create_dispute(
        "Did Company X reduce emissions by 40%?",
        "Context about the claim.",
        "climate",
        TWO_POSITIONS,
        _future_ts(direct_vm, 3600),
        _future_ts(direct_vm, 7200),
        0,
        0,
    )
    assert dispute_id == 0

    dispute = contract.get_dispute(0)
    assert dispute["question"] == "Did Company X reduce emissions by 40%?"
    assert dispute["category"] == "CLIMATE"
    assert dispute["status"] == "ACTIVE"
    assert dispute["position_count"] == 2
    assert dispute["total_stake_wei"] == 0
    assert len(dispute["positions"]) == 2
    assert dispute["positions"][0]["label"] == "Yes"


def test_create_dispute_with_initial_stake_credits_position_zero(
    direct_vm, direct_deploy, direct_owner, direct_alice
):
    contract = _deploy(direct_deploy, direct_owner)
    direct_vm.sender = direct_alice
    direct_vm.value = 1000

    dispute_id = contract.create_dispute(
        "Is this claim accurate?",
        "",
        "media",
        TWO_POSITIONS,
        _future_ts(direct_vm, 3600),
        _future_ts(direct_vm, 7200),
        0,
        0,
    )

    dispute = contract.get_dispute(dispute_id)
    assert dispute["total_stake_wei"] == 1000
    assert dispute["positions"][0]["total_stake_wei"] == 1000

    stake = contract.get_position_stake(dispute_id, 0, _hex(direct_alice))
    assert stake["amount_wei"] == 1000
    assert stake["claimed"] is False


def test_create_dispute_rejects_too_few_positions(direct_vm, direct_deploy, direct_owner, direct_alice):
    contract = _deploy(direct_deploy, direct_owner)
    direct_vm.sender = direct_alice
    direct_vm.value = 0

    with direct_vm.expect_revert():
        contract.create_dispute(
            "Only one side?",
            "",
            "other",
            json.dumps(["OnlyOne"]),
            _future_ts(direct_vm, 3600),
            _future_ts(direct_vm, 7200),
            0,
            0,
        )


def test_create_dispute_rejects_evidence_deadline_before_participation(
    direct_vm, direct_deploy, direct_owner, direct_alice
):
    contract = _deploy(direct_deploy, direct_owner)
    direct_vm.sender = direct_alice
    direct_vm.value = 0

    with direct_vm.expect_revert():
        contract.create_dispute(
            "Bad deadlines",
            "",
            "other",
            TWO_POSITIONS,
            _future_ts(direct_vm, 7200),  # participation deadline AFTER evidence deadline
            _future_ts(direct_vm, 3600),
            0,
            0,
        )


def test_create_dispute_rejects_empty_question(direct_vm, direct_deploy, direct_owner, direct_alice):
    contract = _deploy(direct_deploy, direct_owner)
    direct_vm.sender = direct_alice
    direct_vm.value = 0

    with direct_vm.expect_revert():
        contract.create_dispute(
            "",
            "",
            "other",
            TWO_POSITIONS,
            _future_ts(direct_vm, 3600),
            _future_ts(direct_vm, 7200),
            0,
            0,
        )


def test_stake_position_accumulates_and_updates_totals(
    direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob
):
    contract = _deploy(direct_deploy, direct_owner)
    direct_vm.sender = direct_alice
    direct_vm.value = 0
    dispute_id = contract.create_dispute(
        "Q", "", "other", TWO_POSITIONS, _future_ts(direct_vm, 3600), _future_ts(direct_vm, 7200), 0, 0
    )

    direct_vm.sender = direct_alice
    direct_vm.value = 500
    contract.stake_position(dispute_id, 0)

    direct_vm.sender = direct_bob
    direct_vm.value = 300
    contract.stake_position(dispute_id, 1)

    dispute = contract.get_dispute(dispute_id)
    assert dispute["total_stake_wei"] == 800
    assert dispute["positions"][0]["total_stake_wei"] == 500
    assert dispute["positions"][1]["total_stake_wei"] == 300


def test_stake_position_rejects_zero_value(direct_vm, direct_deploy, direct_owner, direct_alice):
    contract = _deploy(direct_deploy, direct_owner)
    direct_vm.sender = direct_alice
    direct_vm.value = 0
    dispute_id = contract.create_dispute(
        "Q", "", "other", TWO_POSITIONS, _future_ts(direct_vm, 3600), _future_ts(direct_vm, 7200), 0, 0
    )

    direct_vm.value = 0
    with direct_vm.expect_revert():
        contract.stake_position(dispute_id, 0)


def test_stake_position_rejects_invalid_position_index(direct_vm, direct_deploy, direct_owner, direct_alice):
    contract = _deploy(direct_deploy, direct_owner)
    direct_vm.sender = direct_alice
    direct_vm.value = 0
    dispute_id = contract.create_dispute(
        "Q", "", "other", TWO_POSITIONS, _future_ts(direct_vm, 3600), _future_ts(direct_vm, 7200), 0, 0
    )

    direct_vm.value = 100
    with direct_vm.expect_revert():
        contract.stake_position(dispute_id, 5)


def test_stake_position_rejects_after_participation_deadline(
    direct_vm, direct_deploy, direct_owner, direct_alice
):
    contract = _deploy(direct_deploy, direct_owner)
    direct_vm.sender = direct_alice
    direct_vm.value = 0
    dispute_id = contract.create_dispute(
        "Q", "", "other", TWO_POSITIONS, _future_ts(direct_vm, 100), _future_ts(direct_vm, 7200), 0, 0
    )

    direct_vm.warp("2030-01-01T00:00:00Z")
    direct_vm.value = 100
    with direct_vm.expect_revert():
        contract.stake_position(dispute_id, 0)


def test_stake_below_dispute_minimum_rejected(direct_vm, direct_deploy, direct_owner, direct_alice):
    contract = _deploy(direct_deploy, direct_owner)
    direct_vm.sender = direct_alice
    direct_vm.value = 0
    dispute_id = contract.create_dispute(
        "Q", "", "other", TWO_POSITIONS, _future_ts(direct_vm, 3600), _future_ts(direct_vm, 7200), 1000, 0
    )

    direct_vm.value = 500  # below the 1000 wei minimum this dispute set
    with direct_vm.expect_revert():
        contract.stake_position(dispute_id, 0)


def test_creator_can_cancel_before_any_other_participation(
    direct_vm, direct_deploy, direct_owner, direct_alice
):
    contract = _deploy(direct_deploy, direct_owner)
    direct_vm.sender = direct_alice
    direct_vm.value = 100
    dispute_id = contract.create_dispute(
        "Q", "", "other", TWO_POSITIONS, _future_ts(direct_vm, 3600), _future_ts(direct_vm, 7200), 0, 0
    )

    contract.cancel_dispute(dispute_id)
    dispute = contract.get_dispute(dispute_id)
    assert dispute["status"] == "CANCELLED"


def test_creator_cannot_cancel_after_someone_else_staked(
    direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob
):
    contract = _deploy(direct_deploy, direct_owner)
    direct_vm.sender = direct_alice
    direct_vm.value = 100
    dispute_id = contract.create_dispute(
        "Q", "", "other", TWO_POSITIONS, _future_ts(direct_vm, 3600), _future_ts(direct_vm, 7200), 0, 0
    )

    direct_vm.sender = direct_bob
    direct_vm.value = 50
    contract.stake_position(dispute_id, 1)

    direct_vm.sender = direct_alice
    direct_vm.value = 0
    with direct_vm.expect_revert():
        contract.cancel_dispute(dispute_id)


def test_non_creator_non_owner_cannot_cancel(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = _deploy(direct_deploy, direct_owner)
    direct_vm.sender = direct_alice
    direct_vm.value = 0
    dispute_id = contract.create_dispute(
        "Q", "", "other", TWO_POSITIONS, _future_ts(direct_vm, 3600), _future_ts(direct_vm, 7200), 0, 0
    )

    direct_vm.sender = direct_bob
    with direct_vm.expect_revert():
        contract.cancel_dispute(dispute_id)


def test_owner_can_force_cancel(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = _deploy(direct_deploy, direct_owner)
    direct_vm.sender = direct_alice
    direct_vm.value = 100
    dispute_id = contract.create_dispute(
        "Q", "", "other", TWO_POSITIONS, _future_ts(direct_vm, 3600), _future_ts(direct_vm, 7200), 0, 0
    )
    direct_vm.sender = direct_bob
    direct_vm.value = 50
    contract.stake_position(dispute_id, 1)

    direct_vm.sender = direct_owner
    direct_vm.value = 0
    contract.cancel_dispute(dispute_id)
    assert contract.get_dispute(dispute_id)["status"] == "CANCELLED"


def test_only_owner_can_pause(direct_vm, direct_deploy, direct_owner, direct_alice):
    contract = _deploy(direct_deploy, direct_owner)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert():
        contract.pause()

    direct_vm.sender = direct_owner
    contract.pause()
    assert contract.get_config()["paused"] is True


def test_paused_platform_rejects_new_disputes(direct_vm, direct_deploy, direct_owner, direct_alice):
    contract = _deploy(direct_deploy, direct_owner)
    direct_vm.sender = direct_owner
    contract.pause()

    direct_vm.sender = direct_alice
    direct_vm.value = 0
    with direct_vm.expect_revert():
        contract.create_dispute(
            "Q", "", "other", TWO_POSITIONS, _future_ts(direct_vm, 3600), _future_ts(direct_vm, 7200), 0, 0
        )


def test_set_fees_validates_bounds(direct_vm, direct_deploy, direct_owner):
    contract = _deploy(direct_deploy, direct_owner)
    direct_vm.sender = direct_owner

    with direct_vm.expect_revert():
        contract.set_fees(2000, 9000)  # 2000 > MAX_PROTOCOL_FEE_BPS (1000)

    contract.set_fees(200, 8500)
    config = contract.get_config()
    assert config["protocol_fee_bps"] == 200
    assert config["slash_winner_share_bps"] == 8500
    assert config["slash_treasury_share_bps"] == 1500


def test_evidence_outcome_economics_matches_approved_model(direct_deploy, direct_owner):
    contract = _deploy(direct_deploy, direct_owner)
    econ = contract.get_evidence_outcome_economics()
    assert econ["slash_bps_by_outcome"]["STRONGLY_SUPPORTED"] == 0
    assert econ["slash_bps_by_outcome"]["WEAK_OR_INCOMPLETE"] == 2500
    assert econ["slash_bps_by_outcome"]["MATERIALLY_IRRELEVANT"] == 5000
    assert econ["slash_bps_by_outcome"]["MISLEADING"] == 7500
    assert econ["slash_bps_by_outcome"]["FABRICATED_OR_UNVERIFIABLE"] == 10000
    assert econ["slash_bps_by_outcome"]["MALICIOUSLY_MANIPULATED"] == 10000
    assert set(econ["reward_eligible_outcomes"]) == {"STRONGLY_SUPPORTED", "CREDIBLE_AND_RELEVANT"}
    assert econ["flagging_outcomes"] == ["MALICIOUSLY_MANIPULATED"]
