# Veritine contract security — threat model

## Value-transfer / escrow security

**Threat: double-spend / double withdrawal via reentrancy-shaped bugs.**
Mitigation: every payout path follows the strict ordering — read the ledger field into a local, zero the ledger field, persist state, *then* call `_send_gen`. See `claim_position`, `claim_evidence`, and `withdraw`. `_send_gen` is the single emission choke point (wraps `@gl.evm.contract_interface`'s `emit_transfer`) — grepping for `_send_gen` finds every place GEN can leave the contract. A second call to any claim method finds its ledger already zeroed (`position_claims[key]` / `evidence_claims[key]` set to `True`) and reverts before reaching payout math.

**Threat: caller-supplied amount spoofing.**
Mitigation: every payable method reads the deposited amount only from `gl.message.value`, never from a method parameter. `stake_from_balance`-style patterns (staking from an internal balance rather than a fresh deposit) are intentionally *not* implemented, precisely to keep "how much did this address actually deposit" unambiguous.

**Threat: stuck funds if adjudication never runs.**
Mitigation: `ADJUDICATION_TIMEOUT_SECONDS` (7 days past the evidence deadline) — `_timed_out_without_adjudication` / `_mark_timed_out`, checked at the top of every claim method, flips the dispute to `INVALID` and makes every stake fully refundable.

## Prompt injection / untrusted web content

**Threat: a webpage cited as evidence contains text designed to hijack the adjudication prompt** (e.g. "ignore previous instructions", fake system messages, fake scoring rubrics).
Mitigation: `_build_evidence_prompt` explicitly frames fetched content as untrusted data and instructs the model never to follow embedded instructions, treating such attempts as further evidence of unreliability. The model's only externally-influenceable output is a JSON verdict object with a fixed schema (`_parse_evidence_verdict`), not free-form contract behavior — there is no code path where model output can alter contract state beyond the fields explicitly written into `Evidence`/`Dispute` storage.

**Threat: LLM output that isn't valid JSON, or omits required fields.**
Mitigation: `_parse_json_object`, `_sanitize_json_text`, `_coerce_outcome`, and the `_first_present` key-aliasing helpers defensively parse and normalize model output, defaulting unparseable or unrecognized outcomes to the conservative `INCONCLUSIVE` tier (no slash, no reward) rather than crashing or defaulting to an economically extreme tier.

## Consensus / validator security

**Threat: format-only validation that lets a leader unilaterally decide the economically meaningful outcome.**
Mitigation: explicitly avoided per design — see `docs/contracts/ADJUDICATION.md`. Validators independently re-fetch and re-derive the verdict, then compare the *substantive* economic fields (slash tier within a tolerance band, reward eligibility exactly, flagging exactly), not merely that the JSON parses.

**Threat: excessive leader rotation / UNDETERMINED results from overly strict equivalence.**
Mitigation: the 2,500bps tolerance band on slash-tier comparison absorbs ordinary LLM/web-fetch phrasing variance between leader and validator reruns, while reward-eligibility and flagging still require exact agreement (see `docs/contracts/ADJUDICATION.md` for the full rationale and the tests in `contracts/tests/direct/test_validator_tolerance.py` proving both properties).

**Threat: LLM/network errors silently agreed upon, locking in broken state.**
Mitigation: `_handle_leader_error` — deterministic error classes (`[EXPECTED]`, `[EXTERNAL]`) require exact message match; `[TRANSIENT]` failures agree only if both sides hit one; `[LLM_ERROR]` and any unclassified exception always force disagreement, triggering consensus retry rather than accepting a broken result.

## Spam / griefing / DoS

**Threat: spam disputes or evidence to bloat contract storage or exhaust adjudication compute.**
Mitigation: `min_position_stake_wei` / `min_evidence_stake_wei` (platform floor + per-dispute minimum) impose an economic cost on every dispute/evidence submission. `MAX_EVIDENCE_PER_DISPUTE = 20` and `MAX_POSITIONS_PER_DISPUTE = 6` cap the compute cost of a single `request_adjudication` call.

**Threat: duplicate disputes / duplicate evidence.**
Not deterministically prevented on-chain (natural-language questions can't be reliably deduplicated without another adjudication pass) — mitigated economically (minimum stakes) and at the indexing/UI layer (the backend can flag likely duplicates for human review), not a contract-level guarantee.

## Access control

**Threat: unauthorized state changes.**
Every state-mutating admin method (`pause`, `unpause`, `set_fees`, `set_minimums`, `set_treasury_address`, `set_owner`) is gated by `_only_owner`. `cancel_dispute` has a narrower creator-only path (only before any other participant has staked) plus an owner override. `request_adjudication` is deliberately permissionless (must be callable by anyone once the deadline passes, so adjudication can never be gatekept by a single party) but is itself economically self-limiting (gas/compute cost falls on whoever calls it).

## Economic accounting integrity

**Threat: reward-pool over-allocation / negative balances.**
`_evidence_reward_share` derives the dispute-wide slashed-pool total deterministically from already-stored `Evidence.slash_bps` / `.total_stake_wei` fields (not from a running counter that could drift), so every caller computing a share arrives at the same number. The treasury-share credit is guarded by `Dispute.payouts_settled`, set exactly once per dispute, so it cannot be double-credited across multiple evidence claims.

## Known non-goals

- No governance/multisig — a single owner address controls admin functions. Documented as a v1 limitation; see `SECURITY.md` for user-facing disclosure. A future phase could migrate ownership to a multisig or DAO.
- No on-chain appeal mechanism for a finalized `ADJUDICATED` conclusion — once `request_adjudication` completes, the conclusion is final. This mirrors the readme's guidance to keep the contract's scope to "the minimum state transition that needs consensus" rather than adding appeal-cycle complexity in v1.
