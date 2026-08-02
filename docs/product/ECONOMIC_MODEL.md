# Veritine economic model (approved 2026-08-02)

Single source of truth: `packages/shared-config/src/economics.ts` (TypeScript, used by backend/frontend) and `OUTCOME_SLASH_BPS` / `REWARD_ELIGIBLE_OUTCOMES` / `FLAGGING_OUTCOMES` in `contracts/veritine_contract.py` (the contract's own copy — the contract is authoritative; the TS constants must be kept in sync by hand, since GenVM contracts cannot import TS packages). `Veritine.get_evidence_outcome_economics()` exposes the on-chain table directly so this can always be cross-checked.

## Evidence outcome → stake outcome

| Evidence outcome | Slash | Reward eligible | Flagged |
|---|---|---|---|
| Strongly supported | 0% | Yes | No |
| Credible and relevant | 0% | Yes | No |
| Credible but limited | 0% | No | No |
| Inconclusive | 0% | No | No |
| Outdated but not deceptive | 0% | No | No |
| Weak or materially incomplete | 25% | No | No |
| Materially irrelevant | 50% | No | No |
| Misleading | 75% | No | No |
| Fabricated or unverifiable | 100% | No | No |
| Maliciously manipulated | 100% | No | **Yes** — address flagged in `flagged_addresses` |

A submitter is never slashed merely for backing the losing position — slashing is purely a function of the evidence's own adjudicated quality, independent of which position ultimately wins the dispute.

## Position-level economics

The **losing position's** total stake (minus the protocol fee) is redistributed proportionally to the **winning position's** stakers, on top of their own principal back. If the dispute conclusion is `INCONCLUSIVE`, `EVIDENCE_INSUFFICIENT`, `CLAIM_UNSUPPORTED`, or `QUESTION_INVALID` (collectively `NO_WINNER_CONCLUSIONS`), every position staker gets a full refund of their own principal — no redistribution happens.

A larger stake on a position is never treated as evidence of that position being correct — the contract's adjudication prompts explicitly instruct the model not to weigh stake size, and the UI must never present stake totals as a confidence signal (see `docs/architecture/PHASE_1_ARCHITECTURE.md` §9 "Frontend design principles").

## Evidence-level economics

Each evidence item's total stake (submitter's own stake plus any backers) is slashed by that item's own percentage. The after-slash remainder is returned proportionally to that item's stakers. If the outcome was reward-eligible, stakers additionally receive a proportional share of a **dispute-wide reward pool** funded by the slashed portion of every evidence item in that dispute.

## Slash pool split

Every slashed-evidence-stake amount, across a dispute, is split:
- **90%** to the reward pool for reward-eligible evidence stakers (proportional to their evidence's total stake).
- **10%** to the protocol treasury.

## Protocol fee

**2%**, taken only from position-level reward payouts (the winning position's share of the losing pool) — never from refunds, never from returned principal, never from evidence-level payouts (which already fund the treasury via the slash-pool split above).

## Owner-adjustable parameters

`protocol_fee_bps` (capped at 1,000 bps / 10%) and `slash_winner_share_bps` (0–10,000 bps, with the treasury share always `10,000 - winner_share`) are owner-configurable via `set_fees`, in case the approved defaults need tuning post-launch — but the *tiers and their relative ordering* (which outcome slashes more than which) are fixed in contract code, not configurable, since that ordering is the actual trust guarantee the platform offers.

## Edge cases

- **Dispute cancellation** (before any counter-participation, or owner emergency cancel): 100% refund to every existing staker, no fees, no slashing.
- **Adjudication timeout** (evidence deadline + 7 days passes with `request_adjudication` never called): the dispute becomes `INVALID` on the first claim attempt after the window, and every staker gets a full refund — the "stuck funds" recovery path.
- **No evidence submitted**: the conclusion pass still runs with an empty evidence list, and will typically resolve to `EVIDENCE_INSUFFICIENT` (no winner, full refund to position stakers).
- **Tied/duplicate positions**: not specially detected — if a dispute creator defines two functionally identical positions, that's a dispute-design issue for the community to flag, not something the contract enforces.
