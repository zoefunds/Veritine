"""Directly exercises the contract's pure comparison helpers
(_evidence_verdicts_agree / _dispute_conclusions_agree) to prove the
tolerance design: adjacent-tier disagreement between leader and validator
must NOT force consensus failure, but an economically meaningful
disagreement (e.g. fabricated vs strongly supported) MUST. This is the
concrete evidence that the equivalence design avoids unnecessary leader
rotation / UNDETERMINED results while still performing real substantive
validation — not a format-only check."""

CONTRACT_PATH = "contracts/veritine_contract.py"


def _hex(addr) -> str:
    if isinstance(addr, (bytes, bytearray)):
        return "0x" + addr.hex()
    return addr


def _deploy(direct_deploy, treasury):
    return direct_deploy(CONTRACT_PATH, _hex(treasury), 0, 0)


def _verdict(outcome: str, reasoning: str = "reasoning") -> dict:
    return {
        "outcome": outcome,
        "authenticity_status": "a",
        "authority_assessment": "a",
        "relevance_assessment": "a",
        "timeliness_assessment": "a",
        "claim_support_assessment": "a",
        "materiality_assessment": "a",
        "misrepresentation_assessment": "a",
        "reasoning_summary": reasoning,
    }


def test_identical_outcome_agrees(direct_deploy, direct_owner):
    contract = _deploy(direct_deploy, direct_owner)
    assert contract._evidence_verdicts_agree(
        _verdict("STRONGLY_SUPPORTED"), _verdict("STRONGLY_SUPPORTED")
    ) is True


def test_adjacent_tier_within_tolerance_agrees(direct_deploy, direct_owner):
    """WEAK_OR_INCOMPLETE (2500 bps) vs MATERIALLY_IRRELEVANT (5000 bps) is
    exactly a 2500-bps gap — inside the tolerance band — and both are
    reward-ineligible/non-flagged, so validators must agree despite naming
    different tiers. This is what prevents ordinary LLM/web-fetch phrasing
    variance from causing unnecessary leader rotation."""
    contract = _deploy(direct_deploy, direct_owner)
    assert contract._evidence_verdicts_agree(
        _verdict("WEAK_OR_INCOMPLETE"), _verdict("MATERIALLY_IRRELEVANT")
    ) is True


def test_economically_decisive_gap_disagrees(direct_deploy, direct_owner):
    """FABRICATED_OR_UNVERIFIABLE (10000 bps, non-reward) vs
    STRONGLY_SUPPORTED (0 bps, reward-eligible) is both a >2500bps slash
    gap AND a reward-eligibility flip — validators must disagree,
    correctly forcing consensus to reject a leader that wildly
    misclassified the evidence rather than silently accepting it."""
    contract = _deploy(direct_deploy, direct_owner)
    assert contract._evidence_verdicts_agree(
        _verdict("STRONGLY_SUPPORTED"), _verdict("FABRICATED_OR_UNVERIFIABLE")
    ) is False


def test_reward_eligibility_flip_disagrees_even_with_small_slash_gap(direct_deploy, direct_owner):
    """CREDIBLE_AND_RELEVANT (0 bps, reward-eligible) vs
    CREDIBLE_BUT_LIMITED (0 bps, NOT reward-eligible): the slash bps gap
    is 0 (well within tolerance) but reward eligibility flips — this must
    still disagree, since reward eligibility is a directional payment
    swing with no tolerance allowed."""
    contract = _deploy(direct_deploy, direct_owner)
    assert contract._evidence_verdicts_agree(
        _verdict("CREDIBLE_AND_RELEVANT"), _verdict("CREDIBLE_BUT_LIMITED")
    ) is False


def test_flag_disagreement_forces_disagreement_despite_matching_slash(direct_deploy, direct_owner):
    """MALICIOUSLY_MANIPULATED and FABRICATED_OR_UNVERIFIABLE share the
    same 10000bps slash (0 bps gap, well within tolerance), but only one
    carries the address-flagging consequence — flag disagreement must
    still force disagreement."""
    contract = _deploy(direct_deploy, direct_owner)
    assert contract._evidence_verdicts_agree(
        _verdict("FABRICATED_OR_UNVERIFIABLE"), _verdict("MALICIOUSLY_MANIPULATED")
    ) is False


def test_dispute_conclusion_same_winner_different_label_disagrees(direct_deploy, direct_owner):
    """POSITION_SUPPORTED vs PARTIALLY_SUPPORTED for the same winner index
    are still different labels and neither is in NO_WINNER_CONCLUSIONS,
    so they must NOT be silently treated as equivalent."""
    contract = _deploy(direct_deploy, direct_owner)
    leader = {"conclusion": "POSITION_SUPPORTED", "winning_position_index": 0, "reasoning_summary": "x"}
    validator = {"conclusion": "PARTIALLY_SUPPORTED", "winning_position_index": 0, "reasoning_summary": "y"}
    assert contract._dispute_conclusions_agree(leader, validator) is False


def test_dispute_conclusion_equivalent_no_winner_labels_agree(direct_deploy, direct_owner):
    """INCONCLUSIVE and EVIDENCE_INSUFFICIENT both mean 'no winner, full
    refund' economically - validators must agree even if they phrase the
    specific reason differently."""
    contract = _deploy(direct_deploy, direct_owner)
    leader = {"conclusion": "INCONCLUSIVE", "winning_position_index": -1, "reasoning_summary": "x"}
    validator = {"conclusion": "EVIDENCE_INSUFFICIENT", "winning_position_index": -1, "reasoning_summary": "y"}
    assert contract._dispute_conclusions_agree(leader, validator) is True


def test_dispute_conclusion_different_winner_disagrees(direct_deploy, direct_owner):
    contract = _deploy(direct_deploy, direct_owner)
    leader = {"conclusion": "POSITION_SUPPORTED", "winning_position_index": 0, "reasoning_summary": "x"}
    validator = {"conclusion": "POSITION_SUPPORTED", "winning_position_index": 1, "reasoning_summary": "y"}
    assert contract._dispute_conclusions_agree(leader, validator) is False
