// Single source of truth for the approved Veritine economic model.
// See docs/architecture/PHASE_1_ARCHITECTURE.md section 10 for the
// rationale. Both the backend indexer/display logic and the contract
// test suite should reference these values rather than hardcoding
// percentages in multiple places.

import { EvidenceOutcome } from '@veritine/shared-types';

/** Basis points (1/100th of a percent). 10_000 bps = 100%. */
export const BPS_DENOMINATOR = 10_000;

/**
 * Slash percentage (in basis points) applied to an evidence stake for
 * each adjudicated outcome. 0 means the stake is fully refunded (and,
 * for the first two tiers, eligible for a proportional reward share).
 */
export const EVIDENCE_OUTCOME_SLASH_BPS: Record<EvidenceOutcome, number> = {
  [EvidenceOutcome.STRONGLY_SUPPORTED]: 0,
  [EvidenceOutcome.CREDIBLE_AND_RELEVANT]: 0,
  [EvidenceOutcome.CREDIBLE_BUT_LIMITED]: 0,
  [EvidenceOutcome.INCONCLUSIVE]: 0,
  [EvidenceOutcome.OUTDATED_NOT_DECEPTIVE]: 0,
  [EvidenceOutcome.WEAK_OR_INCOMPLETE]: 2_500,
  [EvidenceOutcome.MATERIALLY_IRRELEVANT]: 5_000,
  [EvidenceOutcome.MISLEADING]: 7_500,
  [EvidenceOutcome.FABRICATED_OR_UNVERIFIABLE]: 10_000,
  [EvidenceOutcome.MALICIOUSLY_MANIPULATED]: 10_000,
};

/** Outcomes eligible for a proportional share of the reward pool. */
export const REWARD_ELIGIBLE_OUTCOMES: ReadonlySet<EvidenceOutcome> = new Set([
  EvidenceOutcome.STRONGLY_SUPPORTED,
  EvidenceOutcome.CREDIBLE_AND_RELEVANT,
]);

/** Outcome that additionally flags the submitter's address in contract state. */
export const FLAGGING_OUTCOMES: ReadonlySet<EvidenceOutcome> = new Set([
  EvidenceOutcome.MALICIOUSLY_MANIPULATED,
]);

/** Share of the slashed-stake pool paid to winning-side stakers (basis points). */
export const SLASH_POOL_WINNER_SHARE_BPS = 9_000; // 90%

/** Share of the slashed-stake pool routed to the protocol treasury (basis points). */
export const SLASH_POOL_TREASURY_SHARE_BPS = 1_000; // 10%

/** Protocol fee on reward payouts only - never on refunds or returned principal. */
export const PROTOCOL_FEE_BPS = 200; // 2%
