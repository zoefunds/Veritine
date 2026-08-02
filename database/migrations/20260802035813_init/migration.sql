-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SocialProvider" AS ENUM ('TWITTER', 'DISCORD', 'GITHUB');

-- CreateEnum
CREATE TYPE "DisputeCategory" AS ENUM ('CLIMATE', 'GOVERNANCE', 'TECH', 'MEDIA', 'FINANCE', 'PUBLIC_HEALTH', 'OTHER');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EVIDENCE_OPEN', 'EVIDENCE_CLOSED', 'READY_FOR_ADJUDICATION', 'ADJUDICATING', 'ADJUDICATED', 'REWARDING', 'FINALIZED', 'CANCELLED', 'INVALID', 'INCONCLUSIVE');

-- CreateEnum
CREATE TYPE "StakeStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REFUNDED', 'REWARDED', 'SLASHED');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('PRIMARY_SOURCE', 'OFFICIAL_REPORT', 'REGULATORY_FILING', 'GOVERNMENT_RECORD', 'PEER_REVIEWED_RESEARCH', 'INDEPENDENT_INVESTIGATION', 'REPUTABLE_JOURNALISM', 'ORGANIZATIONAL_PUBLICATION', 'COMMUNITY_GENERATED', 'SOCIAL_MEDIA', 'ARCHIVED_SOURCE', 'ANONYMOUS_SOURCE');

-- CreateEnum
CREATE TYPE "EvidenceOutcome" AS ENUM ('STRONGLY_SUPPORTED', 'CREDIBLE_AND_RELEVANT', 'CREDIBLE_BUT_LIMITED', 'INCONCLUSIVE', 'OUTDATED_NOT_DECEPTIVE', 'WEAK_OR_INCOMPLETE', 'MATERIALLY_IRRELEVANT', 'MISLEADING', 'FABRICATED_OR_UNVERIFIABLE', 'MALICIOUSLY_MANIPULATED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'ADJUDICATED');

-- CreateEnum
CREATE TYPE "DisputeConclusion" AS ENUM ('POSITION_SUPPORTED', 'PARTIALLY_SUPPORTED', 'CLAIM_MATERIALLY_MISLEADING', 'CLAIM_UNSUPPORTED', 'EVIDENCE_INSUFFICIENT', 'INCONCLUSIVE', 'QUESTION_INVALID');

-- CreateEnum
CREATE TYPE "DistributionStatus" AS ENUM ('PENDING', 'CLAIMABLE', 'CLAIMED');

-- CreateEnum
CREATE TYPE "StakeSourceType" AS ENUM ('POSITION_STAKE', 'EVIDENCE_STAKE');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'REJECTED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('DISPUTE_CREATED', 'EVIDENCE_SUBMITTED', 'STAKE_ACCEPTED', 'PARTICIPATION_DEADLINE_APPROACHING', 'EVIDENCE_DEADLINE_APPROACHING', 'ADJUDICATION_STARTED', 'ADJUDICATION_COMPLETED', 'REWARD_AVAILABLE', 'SLASH_APPLIED', 'WITHDRAWAL_COMPLETED', 'TRANSACTION_FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "primaryWalletAddress" TEXT NOT NULL,
    "displayName" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthNonce" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthNonce_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "SocialProvider" NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "providerUsername" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "contractDisputeId" TEXT,
    "question" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" "DisputeCategory" NOT NULL,
    "creatorUserId" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'DRAFT',
    "participationDeadline" TIMESTAMP(3) NOT NULL,
    "evidenceDeadline" TIMESTAMP(3) NOT NULL,
    "minPositionStakeWei" TEXT NOT NULL,
    "minEvidenceStakeWei" TEXT NOT NULL,
    "totalStakeWei" TEXT NOT NULL DEFAULT '0',
    "contractSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisputePosition" (
    "id" TEXT NOT NULL,
    "contractPositionId" TEXT,
    "disputeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "totalStakeWei" TEXT NOT NULL DEFAULT '0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisputePosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PositionStake" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "stakerUserId" TEXT NOT NULL,
    "amountWei" TEXT NOT NULL,
    "contractTxHash" TEXT,
    "status" "StakeStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PositionStake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "contractEvidenceId" TEXT,
    "disputeId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "submitterUserId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "canonicalUrl" TEXT,
    "sourceTitle" TEXT NOT NULL,
    "publisher" TEXT NOT NULL,
    "publicationDate" TIMESTAMP(3),
    "retrievalDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summary" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "submitterStakeWei" TEXT NOT NULL,
    "totalStakeWei" TEXT NOT NULL DEFAULT '0',
    "contentHash" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "outcome" "EvidenceOutcome",
    "reasoningSummary" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceSourceSnapshot" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contentHash" TEXT NOT NULL,
    "httpStatus" INTEGER,
    "rawContentRef" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceSourceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceStake" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "stakerUserId" TEXT NOT NULL,
    "amountWei" TEXT NOT NULL,
    "contractTxHash" TEXT,
    "status" "StakeStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceStake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdjudicationResult" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "conclusion" "DisputeConclusion" NOT NULL,
    "winningPositionId" TEXT,
    "reasoningSummary" TEXT NOT NULL,
    "keySupportingSources" JSONB,
    "keyContradictorySources" JSONB,
    "limitations" TEXT,
    "contractTxHash" TEXT NOT NULL,
    "adjudicatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdjudicationResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceVerdict" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "adjudicationResultId" TEXT NOT NULL,
    "outcome" "EvidenceOutcome" NOT NULL,
    "authenticityStatus" TEXT NOT NULL,
    "authorityAssessment" TEXT NOT NULL,
    "relevanceAssessment" TEXT NOT NULL,
    "timelinessAssessment" TEXT NOT NULL,
    "claimSupportAssessment" TEXT NOT NULL,
    "materialityAssessment" TEXT NOT NULL,
    "misrepresentationAssessment" TEXT NOT NULL,
    "reasoningSummary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceVerdict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardDistribution" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "sourceType" "StakeSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "amountWei" TEXT NOT NULL,
    "contractTxHash" TEXT,
    "status" "DistributionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "RewardDistribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlashingRecord" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "evidenceId" TEXT,
    "stakerUserId" TEXT NOT NULL,
    "amountWei" TEXT NOT NULL,
    "reasonOutcome" "EvidenceOutcome" NOT NULL,
    "contractTxHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlashingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Withdrawal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "disputeId" TEXT,
    "amountWei" TEXT NOT NULL,
    "contractTxHash" TEXT,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "Withdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractTransaction" (
    "id" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "relatedEntityType" TEXT NOT NULL,
    "relatedEntityId" TEXT NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB,
    "submittedByUserId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "ContractTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "payload" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_primaryWalletAddress_key" ON "User"("primaryWalletAddress");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_address_key" ON "Wallet"("address");

-- CreateIndex
CREATE INDEX "Wallet_userId_idx" ON "Wallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthNonce_nonce_key" ON "AuthNonce"("nonce");

-- CreateIndex
CREATE INDEX "AuthNonce_address_idx" ON "AuthNonce"("address");

-- CreateIndex
CREATE INDEX "AuthNonce_expiresAt_idx" ON "AuthNonce"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_tokenHash_idx" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "SocialConnection_userId_idx" ON "SocialConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialConnection_provider_providerUserId_key" ON "SocialConnection"("provider", "providerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Dispute_contractDisputeId_key" ON "Dispute"("contractDisputeId");

-- CreateIndex
CREATE INDEX "Dispute_status_idx" ON "Dispute"("status");

-- CreateIndex
CREATE INDEX "Dispute_category_idx" ON "Dispute"("category");

-- CreateIndex
CREATE INDEX "Dispute_creatorUserId_idx" ON "Dispute"("creatorUserId");

-- CreateIndex
CREATE INDEX "DisputePosition_disputeId_idx" ON "DisputePosition"("disputeId");

-- CreateIndex
CREATE UNIQUE INDEX "DisputePosition_disputeId_contractPositionId_key" ON "DisputePosition"("disputeId", "contractPositionId");

-- CreateIndex
CREATE INDEX "PositionStake_disputeId_idx" ON "PositionStake"("disputeId");

-- CreateIndex
CREATE INDEX "PositionStake_positionId_idx" ON "PositionStake"("positionId");

-- CreateIndex
CREATE INDEX "PositionStake_stakerUserId_idx" ON "PositionStake"("stakerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Evidence_contractEvidenceId_key" ON "Evidence"("contractEvidenceId");

-- CreateIndex
CREATE INDEX "Evidence_disputeId_idx" ON "Evidence"("disputeId");

-- CreateIndex
CREATE INDEX "Evidence_positionId_idx" ON "Evidence"("positionId");

-- CreateIndex
CREATE INDEX "Evidence_submitterUserId_idx" ON "Evidence"("submitterUserId");

-- CreateIndex
CREATE INDEX "Evidence_verificationStatus_idx" ON "Evidence"("verificationStatus");

-- CreateIndex
CREATE INDEX "EvidenceSourceSnapshot_evidenceId_idx" ON "EvidenceSourceSnapshot"("evidenceId");

-- CreateIndex
CREATE INDEX "EvidenceStake_evidenceId_idx" ON "EvidenceStake"("evidenceId");

-- CreateIndex
CREATE INDEX "EvidenceStake_stakerUserId_idx" ON "EvidenceStake"("stakerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "AdjudicationResult_disputeId_key" ON "AdjudicationResult"("disputeId");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceVerdict_evidenceId_key" ON "EvidenceVerdict"("evidenceId");

-- CreateIndex
CREATE INDEX "EvidenceVerdict_adjudicationResultId_idx" ON "EvidenceVerdict"("adjudicationResultId");

-- CreateIndex
CREATE INDEX "RewardDistribution_disputeId_idx" ON "RewardDistribution"("disputeId");

-- CreateIndex
CREATE INDEX "RewardDistribution_recipientUserId_idx" ON "RewardDistribution"("recipientUserId");

-- CreateIndex
CREATE INDEX "SlashingRecord_disputeId_idx" ON "SlashingRecord"("disputeId");

-- CreateIndex
CREATE INDEX "SlashingRecord_evidenceId_idx" ON "SlashingRecord"("evidenceId");

-- CreateIndex
CREATE INDEX "SlashingRecord_stakerUserId_idx" ON "SlashingRecord"("stakerUserId");

-- CreateIndex
CREATE INDEX "Withdrawal_userId_idx" ON "Withdrawal"("userId");

-- CreateIndex
CREATE INDEX "Withdrawal_disputeId_idx" ON "Withdrawal"("disputeId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractTransaction_txHash_key" ON "ContractTransaction"("txHash");

-- CreateIndex
CREATE INDEX "ContractTransaction_relatedEntityType_relatedEntityId_idx" ON "ContractTransaction"("relatedEntityType", "relatedEntityId");

-- CreateIndex
CREATE INDEX "ContractTransaction_status_idx" ON "ContractTransaction"("status");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialConnection" ADD CONSTRAINT "SocialConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_creatorUserId_fkey" FOREIGN KEY ("creatorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputePosition" ADD CONSTRAINT "DisputePosition_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionStake" ADD CONSTRAINT "PositionStake_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionStake" ADD CONSTRAINT "PositionStake_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "DisputePosition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionStake" ADD CONSTRAINT "PositionStake_stakerUserId_fkey" FOREIGN KEY ("stakerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "DisputePosition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_submitterUserId_fkey" FOREIGN KEY ("submitterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceSourceSnapshot" ADD CONSTRAINT "EvidenceSourceSnapshot_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceStake" ADD CONSTRAINT "EvidenceStake_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceStake" ADD CONSTRAINT "EvidenceStake_stakerUserId_fkey" FOREIGN KEY ("stakerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdjudicationResult" ADD CONSTRAINT "AdjudicationResult_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceVerdict" ADD CONSTRAINT "EvidenceVerdict_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceVerdict" ADD CONSTRAINT "EvidenceVerdict_adjudicationResultId_fkey" FOREIGN KEY ("adjudicationResultId") REFERENCES "AdjudicationResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardDistribution" ADD CONSTRAINT "RewardDistribution_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardDistribution" ADD CONSTRAINT "RewardDistribution_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlashingRecord" ADD CONSTRAINT "SlashingRecord_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlashingRecord" ADD CONSTRAINT "SlashingRecord_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlashingRecord" ADD CONSTRAINT "SlashingRecord_stakerUserId_fkey" FOREIGN KEY ("stakerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
