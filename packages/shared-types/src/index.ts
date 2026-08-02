// Domain types shared across the Veritine frontend, backend, and contract
// client. This is the single source of truth for enum values that must
// stay in sync with the GenLayer Intelligent Contract's state machine and
// economic model - see docs/architecture/PHASE_1_ARCHITECTURE.md.

/** Dispute lifecycle state machine (contract-authoritative). */
export enum DisputeStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  EVIDENCE_OPEN = 'EVIDENCE_OPEN',
  EVIDENCE_CLOSED = 'EVIDENCE_CLOSED',
  READY_FOR_ADJUDICATION = 'READY_FOR_ADJUDICATION',
  ADJUDICATING = 'ADJUDICATING',
  ADJUDICATED = 'ADJUDICATED',
  REWARDING = 'REWARDING',
  FINALIZED = 'FINALIZED',
  CANCELLED = 'CANCELLED',
  INVALID = 'INVALID',
  INCONCLUSIVE = 'INCONCLUSIVE',
}

/** Overall dispute conclusion produced by adjudication. */
export enum DisputeConclusion {
  POSITION_SUPPORTED = 'POSITION_SUPPORTED',
  PARTIALLY_SUPPORTED = 'PARTIALLY_SUPPORTED',
  CLAIM_MATERIALLY_MISLEADING = 'CLAIM_MATERIALLY_MISLEADING',
  CLAIM_UNSUPPORTED = 'CLAIM_UNSUPPORTED',
  EVIDENCE_INSUFFICIENT = 'EVIDENCE_INSUFFICIENT',
  INCONCLUSIVE = 'INCONCLUSIVE',
  QUESTION_INVALID = 'QUESTION_INVALID',
}

/**
 * Per-evidence adjudication outcome. Maps 1:1 to the approved economic
 * model in docs/architecture/PHASE_1_ARCHITECTURE.md section 10 - the
 * exact percentages live in @veritine/shared-config's ECONOMIC_MODEL
 * constant, not here, so there is one place to change them.
 */
export enum EvidenceOutcome {
  STRONGLY_SUPPORTED = 'STRONGLY_SUPPORTED',
  CREDIBLE_AND_RELEVANT = 'CREDIBLE_AND_RELEVANT',
  CREDIBLE_BUT_LIMITED = 'CREDIBLE_BUT_LIMITED',
  INCONCLUSIVE = 'INCONCLUSIVE',
  OUTDATED_NOT_DECEPTIVE = 'OUTDATED_NOT_DECEPTIVE',
  WEAK_OR_INCOMPLETE = 'WEAK_OR_INCOMPLETE',
  MATERIALLY_IRRELEVANT = 'MATERIALLY_IRRELEVANT',
  MISLEADING = 'MISLEADING',
  FABRICATED_OR_UNVERIFIABLE = 'FABRICATED_OR_UNVERIFIABLE',
  MALICIOUSLY_MANIPULATED = 'MALICIOUSLY_MANIPULATED',
}

export enum SourceType {
  PRIMARY_SOURCE = 'PRIMARY_SOURCE',
  OFFICIAL_REPORT = 'OFFICIAL_REPORT',
  REGULATORY_FILING = 'REGULATORY_FILING',
  GOVERNMENT_RECORD = 'GOVERNMENT_RECORD',
  PEER_REVIEWED_RESEARCH = 'PEER_REVIEWED_RESEARCH',
  INDEPENDENT_INVESTIGATION = 'INDEPENDENT_INVESTIGATION',
  REPUTABLE_JOURNALISM = 'REPUTABLE_JOURNALISM',
  ORGANIZATIONAL_PUBLICATION = 'ORGANIZATIONAL_PUBLICATION',
  COMMUNITY_GENERATED = 'COMMUNITY_GENERATED',
  SOCIAL_MEDIA = 'SOCIAL_MEDIA',
  ARCHIVED_SOURCE = 'ARCHIVED_SOURCE',
  ANONYMOUS_SOURCE = 'ANONYMOUS_SOURCE',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
  REJECTED = 'REJECTED',
}

export interface DisputePosition {
  id: string;
  disputeId: string;
  label: string;
  totalStakeWei: string;
}

export interface Dispute {
  id: string;
  question: string;
  description: string;
  category: string;
  creatorAddress: string;
  status: DisputeStatus;
  positions: DisputePosition[];
  participationDeadline: string; // ISO timestamp
  evidenceDeadline: string; // ISO timestamp
  minPositionStakeWei: string;
  minEvidenceStakeWei: string;
  totalStakeWei: string;
  createdAt: string;
}

export interface EvidenceSubmission {
  id: string;
  disputeId: string;
  positionId: string;
  submitterAddress: string;
  sourceUrl: string;
  sourceTitle: string;
  publisher: string;
  publicationDate: string | null;
  retrievalDate: string;
  summary: string;
  sourceType: SourceType;
  stakeWei: string;
  submittedAt: string;
  outcome: EvidenceOutcome | null;
  reasoningSummary: string | null;
}

export interface AdjudicationResult {
  disputeId: string;
  conclusion: DisputeConclusion;
  winningPositionId: string | null;
  reasoningSummary: string;
  evidenceOutcomes: Array<{ evidenceId: string; outcome: EvidenceOutcome }>;
  adjudicatedAt: string;
  contractTxHash: string;
}

export interface ContractTransaction {
  hash: string;
  method: string;
  status: TransactionStatus;
  submittedAt: string;
  confirmedAt: string | null;
}
