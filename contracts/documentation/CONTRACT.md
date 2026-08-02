# Veritine Intelligent Contract

Source: [`contracts/veritine_contract.py`](../veritine_contract.py) (~1,900 lines).
Deployment target: **GenLayer Studio / StudioNet**, fees in GEN.

## Responsibilities

The contract is the sole source of truth for:
- Dispute lifecycle state (creation, positions, deadlines, status)
- Position-level and evidence-level GEN stakes
- Evidence adjudication verdicts (per-item, 10-tier outcome classification)
- The overall dispute conclusion (7-tag classification, winning position)
- Reward, refund, and slash accounting
- Withdrawable balances and the real GEN transfer path

The backend indexes and mirrors this state for fast reads/search but never overrides it — see `docs/architecture/PHASE_1_ARCHITECTURE.md` §4 for the full on-chain/off-chain responsibility matrix.

## Storage

| Field | Type | Purpose |
|---|---|---|
| `owner`, `treasury_address`, `paused` | `Address`, `Address`, `bool` | Admin config |
| `protocol_fee_bps`, `slash_winner_share_bps`, `slash_treasury_share_bps` | `u32` | Economic model parameters (owner-adjustable within caps) |
| `min_position_stake_wei`, `min_evidence_stake_wei` | `u256` | Platform-wide stake floors |
| `accrued_treasury_wei` | `u256` | Pending treasury sweep balance |
| `disputes` | `TreeMap[u32, Dispute]` | All disputes |
| `dispute_positions` | `TreeMap[u32, DynArray[Position]]` | Positions per dispute |
| `dispute_evidence_ids` | `TreeMap[u32, DynArray[u32]]` | Evidence index per dispute |
| `evidence_store` | `TreeMap[u32, Evidence]` | All evidence, with adjudication results |
| `position_stakes` / `position_claims` | `TreeMap[str, u256]` / `TreeMap[str, bool]` | Per-staker position ledger, keyed `"{dispute_id}:{position_index}:{0xaddress}"` |
| `evidence_stakes` / `evidence_claims` | `TreeMap[str, u256]` / `TreeMap[str, bool]` | Per-staker evidence ledger, keyed `"{evidence_id}:{0xaddress}"` |
| `balances` | `TreeMap[Address, u256]` | Internal withdrawable balances (outbound value-transfer half) |
| `flagged_addresses` | `TreeMap[Address, u32]` | Malicious-manipulation flag counts |
| `activity` | `TreeMap[u32, DynArray[ActivityEvent]]` | Per-dispute transparent activity log |

## Methods (34 total: 16 write, 18 view)

**Lifecycle**: `create_dispute` (payable), `stake_position` (payable), `submit_evidence` (payable), `stake_evidence` (payable), `cancel_dispute`.

**Adjudication**: `request_adjudication` — permissionless after the evidence deadline; fetches and evaluates every un-adjudicated evidence item, then produces the dispute conclusion.

**Value transfer**: `claim_position`, `claim_evidence`, `withdraw`, `sweep_treasury`.

**Admin**: `pause`, `unpause`, `set_fees`, `set_minimums`, `set_treasury_address`, `set_owner`.

**Views**: dispute/evidence/position getters, pagination, activity log, platform stats, config, and `get_evidence_outcome_economics()` which exposes the exact approved slash/reward table on-chain for transparency.

## Access control

- `create_dispute`, `stake_position`, `submit_evidence`, `stake_evidence`: any address, subject to deadlines/minimums/pause state.
- `cancel_dispute`: dispute creator (only before any other participation) or contract owner (any time while active).
- `request_adjudication`: permissionless, but only after the evidence deadline.
- `claim_position`, `claim_evidence`, `withdraw`: the staker/balance-holder themselves, no delegation.
- `pause`, `unpause`, `set_fees`, `set_minimums`, `set_treasury_address`, `set_owner`, `sweep_treasury`: owner-only (except `sweep_treasury`, deliberately left permissionless to call — it only ever pays into the configured treasury address, so there is no incentive to restrict who triggers it).

## State machine

```
ACTIVE ──(evidence deadline passes)──> EVIDENCE_CLOSED ──(request_adjudication)──> ADJUDICATED
  │                                         │
  ├──(creator, no participation yet)──> CANCELLED
  ├──(owner, any time)─────────────────> CANCELLED
  └──(timeout: evidence_deadline + 7 days, never adjudicated)──> INVALID
```

`ADJUDICATED`, `CANCELLED`, and `INVALID` are terminal — `claim_position`/`claim_evidence` are valid in all three (with different payout math), nowhere else. The `EVIDENCE_CLOSED` transition happens automatically inline on the first `request_adjudication` call rather than via a separate transaction.

## Staking and evidence handling

Position stakes and evidence stakes are tracked in **separate ledgers** with the same escrow discipline (see below). Multiple addresses can back the same evidence item (the submitter's own stake plus any number of backers); all share that item's adjudicated outcome proportionally to their contribution.

## Adjudication

See `docs/contracts/ADJUDICATION.md` for the full process and equivalence-principle design.

## Rewards, slashing, withdrawals

See `docs/product/ECONOMIC_MODEL.md` and `docs/architecture/PHASE_1_ARCHITECTURE.md` §10 for the approved percentages. In short: per-evidence-item slash (0/25/50/75/100%) based on a 10-tier outcome classification, reward eligibility restricted to the top two tiers, a dispute-wide reward pool funded by slashed stakes (90% to winners / 10% to treasury), and a 2% protocol fee on position-level reward payouts only (never on refunds).

## Known limitations

- `request_adjudication` processes all un-adjudicated evidence for a dispute in a single transaction; `MAX_EVIDENCE_PER_DISPUTE = 20` bounds this to keep compute predictable, but a dispute with many evidence items will cost more gas to adjudicate than one with few.
- The dispute-conclusion prompt reasons over already-adjudicated evidence summaries rather than re-reading full source text, to keep the final adjudication call's compute bounded — this is a deliberate two-pass design (per-evidence adjudication, then a conclusion pass over the results), not an oversight.
- Position-level "losing" stakes are fully redistributed to the winning position (minus the protocol fee) — there is no partial-credit mechanism at the position level (evidence-level slashing already provides proportional treatment at the evidence level).

## Security assumptions

See `docs/security/CONTRACT_SECURITY.md` for the full threat model.
