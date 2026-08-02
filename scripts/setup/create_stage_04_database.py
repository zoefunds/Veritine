#!/usr/bin/env python3
"""
Veritine - Stage 04: Database and backend foundation.

Creates the Prisma schema (single source of truth for the PostgreSQL
schema), a seed script, the PrismaService + a first repository/module
pair (UsersModule) wired into the NestJS app, and database documentation.

Design note: the Prisma schema file lives at database/schema.prisma
(not database/schemas/schema.prisma) specifically so that `prisma migrate`
creates database/migrations/ as a sibling directory automatically, matching
the project's required repository structure without extra CLI flags.
database/schemas/ is used for the human-readable ERD/entity documentation
instead.

Run from: /Users/macbook/source-stake  (the project root)
Command:  python3 scripts/setup/create_stage_04_database.py

Safe to rerun: yes, overwrites the files it manages. Never touches
database/migrations/ (owned by the Prisma CLI) or actual data.
"""

import os
import sys

ROOT = os.getcwd()

DIRS = [
    "database/schemas",
    "database/seeds",
    "database/documentation",
    "apps/api/src/shared",
    "apps/api/src/modules/users",
]

FILES = {}

# ---------------------------------------------------------------------------
# Prisma schema (single source of truth for the DB structure)
# ---------------------------------------------------------------------------

FILES["database/schema.prisma"] = """// Veritine database schema.
//
// Scope reminder (see docs/architecture/PHASE_1_ARCHITECTURE.md section 4):
// this database is an INDEX/MIRROR of contract-owned state plus off-chain
// concerns (profiles, sessions, notifications, search, cached source
// snapshots). It is never the authoritative source for stake amounts,
// adjudication outcomes, or reward/slash results - those are read from
// the GenLayer Intelligent Contract and reconciled here via
// contractSyncedAt / contract transaction tracking.

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ---------------------------------------------------------------------------
// Identity, auth, social linking
// ---------------------------------------------------------------------------

enum UserStatus {
  ACTIVE
  SUSPENDED
}

model User {
  id                 String    @id @default(uuid())
  primaryWalletAddress String  @unique
  displayName        String?
  status             UserStatus @default(ACTIVE)
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  wallets            Wallet[]
  sessions           Session[]
  socialConnections  SocialConnection[]
  disputesCreated    Dispute[]           @relation("DisputeCreator")
  positionStakes     PositionStake[]
  evidenceSubmitted  Evidence[]          @relation("EvidenceSubmitter")
  evidenceStakes     EvidenceStake[]
  rewardDistributions RewardDistribution[]
  slashingRecords    SlashingRecord[]
  withdrawals        Withdrawal[]
  notifications      Notification[]
  auditLogs          AuditLog[]

  @@index([status])
}

model Wallet {
  id         String   @id @default(uuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  address    String   @unique
  chainId    String
  verifiedAt DateTime
  createdAt  DateTime @default(now())

  @@index([userId])
}

/// One-time nonces for wallet-signature authentication. Single-use,
/// TTL-bound (see NONCE_TTL_SECONDS) - consumedAt is set the instant a
/// nonce is verified so it can never be replayed.
model AuthNonce {
  id         String    @id @default(uuid())
  address    String
  nonce      String    @unique
  expiresAt  DateTime
  consumedAt DateTime?
  createdAt  DateTime  @default(now())

  @@index([address])
  @@index([expiresAt])
}

model Session {
  id         String    @id @default(uuid())
  userId     String
  user       User      @relation(fields: [userId], references: [id])
  tokenHash  String    @unique
  address    String
  expiresAt  DateTime
  revokedAt  DateTime?
  createdAt  DateTime  @default(now())

  @@index([userId])
  @@index([tokenHash])
}

enum SocialProvider {
  TWITTER
  DISCORD
  GITHUB
}

/// Social accounts are linked via OAuth connection only - never by the
/// user typing a free-text username - to prevent impersonation of
/// someone else's handle.
model SocialConnection {
  id               String         @id @default(uuid())
  userId           String
  user             User           @relation(fields: [userId], references: [id])
  provider         SocialProvider
  providerUserId   String
  providerUsername String
  connectedAt      DateTime       @default(now())

  @@unique([provider, providerUserId])
  @@index([userId])
}

// ---------------------------------------------------------------------------
// Disputes, positions, evidence
// ---------------------------------------------------------------------------

enum DisputeCategory {
  CLIMATE
  GOVERNANCE
  TECH
  MEDIA
  FINANCE
  PUBLIC_HEALTH
  OTHER
}

enum DisputeStatus {
  DRAFT
  ACTIVE
  EVIDENCE_OPEN
  EVIDENCE_CLOSED
  READY_FOR_ADJUDICATION
  ADJUDICATING
  ADJUDICATED
  REWARDING
  FINALIZED
  CANCELLED
  INVALID
  INCONCLUSIVE
}

model Dispute {
  id                    String          @id @default(uuid())
  contractDisputeId     String?         @unique
  question              String
  description           String          @default("")
  category              DisputeCategory
  creatorUserId         String
  creator               User            @relation("DisputeCreator", fields: [creatorUserId], references: [id])
  status                DisputeStatus   @default(DRAFT)
  participationDeadline DateTime
  evidenceDeadline      DateTime
  minPositionStakeWei   String
  minEvidenceStakeWei   String
  totalStakeWei         String          @default("0")
  contractSyncedAt      DateTime?
  createdAt             DateTime        @default(now())
  updatedAt             DateTime        @updatedAt

  positions             DisputePosition[]
  evidence              Evidence[]
  positionStakes        PositionStake[]
  adjudicationResult    AdjudicationResult?
  rewardDistributions   RewardDistribution[]
  slashingRecords       SlashingRecord[]
  withdrawals           Withdrawal[]

  @@index([status])
  @@index([category])
  @@index([creatorUserId])
}

model DisputePosition {
  id                 String   @id @default(uuid())
  contractPositionId String?
  disputeId          String
  dispute            Dispute  @relation(fields: [disputeId], references: [id])
  label               String
  totalStakeWei       String  @default("0")
  createdAt           DateTime @default(now())

  evidence            Evidence[]
  positionStakes      PositionStake[]

  @@unique([disputeId, contractPositionId])
  @@index([disputeId])
}

model PositionStake {
  id              String        @id @default(uuid())
  disputeId       String
  dispute         Dispute       @relation(fields: [disputeId], references: [id])
  positionId      String
  position        DisputePosition @relation(fields: [positionId], references: [id])
  stakerUserId    String
  staker          User          @relation(fields: [stakerUserId], references: [id])
  amountWei       String
  contractTxHash  String?
  status          StakeStatus   @default(PENDING)
  createdAt       DateTime      @default(now())

  @@index([disputeId])
  @@index([positionId])
  @@index([stakerUserId])
}

enum StakeStatus {
  PENDING
  CONFIRMED
  REFUNDED
  REWARDED
  SLASHED
}

enum SourceType {
  PRIMARY_SOURCE
  OFFICIAL_REPORT
  REGULATORY_FILING
  GOVERNMENT_RECORD
  PEER_REVIEWED_RESEARCH
  INDEPENDENT_INVESTIGATION
  REPUTABLE_JOURNALISM
  ORGANIZATIONAL_PUBLICATION
  COMMUNITY_GENERATED
  SOCIAL_MEDIA
  ARCHIVED_SOURCE
  ANONYMOUS_SOURCE
}

enum EvidenceOutcome {
  STRONGLY_SUPPORTED
  CREDIBLE_AND_RELEVANT
  CREDIBLE_BUT_LIMITED
  INCONCLUSIVE
  OUTDATED_NOT_DECEPTIVE
  WEAK_OR_INCOMPLETE
  MATERIALLY_IRRELEVANT
  MISLEADING
  FABRICATED_OR_UNVERIFIABLE
  MALICIOUSLY_MANIPULATED
}

model Evidence {
  id                  String           @id @default(uuid())
  contractEvidenceId  String?          @unique
  disputeId           String
  dispute             Dispute          @relation(fields: [disputeId], references: [id])
  positionId          String
  position            DisputePosition  @relation(fields: [positionId], references: [id])
  submitterUserId     String
  submitter           User             @relation("EvidenceSubmitter", fields: [submitterUserId], references: [id])
  sourceUrl           String
  canonicalUrl        String?
  sourceTitle         String
  publisher           String
  publicationDate     DateTime?
  retrievalDate       DateTime         @default(now())
  summary             String
  sourceType          SourceType
  submitterStakeWei   String
  totalStakeWei       String           @default("0")
  contentHash         String?
  verificationStatus  VerificationStatus @default(PENDING)
  outcome             EvidenceOutcome?
  reasoningSummary    String?
  submittedAt         DateTime         @default(now())

  snapshots           EvidenceSourceSnapshot[]
  evidenceStakes      EvidenceStake[]
  evidenceVerdict     EvidenceVerdict?
  slashingRecords     SlashingRecord[]

  @@index([disputeId])
  @@index([positionId])
  @@index([submitterUserId])
  @@index([verificationStatus])
}

enum VerificationStatus {
  PENDING
  ADJUDICATED
}

/// Cached, content-hashed snapshot of what the contract's web-fetch step
/// actually retrieved for a piece of evidence at adjudication time - kept
/// for transparency/audit. Not authoritative; the contract's own stored
/// hash is authoritative if the two ever disagree.
model EvidenceSourceSnapshot {
  id           String   @id @default(uuid())
  evidenceId   String
  evidence     Evidence @relation(fields: [evidenceId], references: [id])
  fetchedAt    DateTime @default(now())
  contentHash  String
  httpStatus   Int?
  rawContentRef String  // pointer to cached content (file/object storage key), never inlined here
  createdAt    DateTime @default(now())

  @@index([evidenceId])
}

model EvidenceStake {
  id             String      @id @default(uuid())
  evidenceId     String
  evidence       Evidence    @relation(fields: [evidenceId], references: [id])
  stakerUserId   String
  staker         User        @relation(fields: [stakerUserId], references: [id])
  amountWei      String
  contractTxHash String?
  status         StakeStatus @default(PENDING)
  createdAt      DateTime    @default(now())

  @@index([evidenceId])
  @@index([stakerUserId])
}

// ---------------------------------------------------------------------------
// Adjudication, rewards, slashing, withdrawals
// ---------------------------------------------------------------------------

enum DisputeConclusion {
  POSITION_SUPPORTED
  PARTIALLY_SUPPORTED
  CLAIM_MATERIALLY_MISLEADING
  CLAIM_UNSUPPORTED
  EVIDENCE_INSUFFICIENT
  INCONCLUSIVE
  QUESTION_INVALID
}

model AdjudicationResult {
  id                       String            @id @default(uuid())
  disputeId                String            @unique
  dispute                  Dispute           @relation(fields: [disputeId], references: [id])
  conclusion               DisputeConclusion
  winningPositionId        String?
  reasoningSummary         String
  keySupportingSources     Json?
  keyContradictorySources  Json?
  limitations              String?
  contractTxHash           String
  adjudicatedAt            DateTime
  createdAt                DateTime          @default(now())

  evidenceVerdicts         EvidenceVerdict[]
}

model EvidenceVerdict {
  id                          String              @id @default(uuid())
  evidenceId                  String              @unique
  evidence                    Evidence            @relation(fields: [evidenceId], references: [id])
  adjudicationResultId        String
  adjudicationResult          AdjudicationResult  @relation(fields: [adjudicationResultId], references: [id])
  outcome                     EvidenceOutcome
  authenticityStatus          String
  authorityAssessment         String
  relevanceAssessment         String
  timelinessAssessment        String
  claimSupportAssessment      String
  materialityAssessment       String
  misrepresentationAssessment String
  reasoningSummary            String
  createdAt                   DateTime            @default(now())

  @@index([adjudicationResultId])
}

enum DistributionStatus {
  PENDING
  CLAIMABLE
  CLAIMED
}

enum StakeSourceType {
  POSITION_STAKE
  EVIDENCE_STAKE
}

model RewardDistribution {
  id             String              @id @default(uuid())
  disputeId      String
  dispute        Dispute             @relation(fields: [disputeId], references: [id])
  recipientUserId String
  recipient      User                @relation(fields: [recipientUserId], references: [id])
  sourceType     StakeSourceType
  sourceId       String
  amountWei      String
  contractTxHash String?
  status         DistributionStatus  @default(PENDING)
  createdAt      DateTime            @default(now())
  claimedAt      DateTime?

  @@index([disputeId])
  @@index([recipientUserId])
}

model SlashingRecord {
  id             String          @id @default(uuid())
  disputeId      String
  dispute        Dispute         @relation(fields: [disputeId], references: [id])
  evidenceId     String?
  evidence       Evidence?       @relation(fields: [evidenceId], references: [id])
  stakerUserId   String
  staker         User            @relation(fields: [stakerUserId], references: [id])
  amountWei      String
  reasonOutcome  EvidenceOutcome
  contractTxHash String
  createdAt      DateTime        @default(now())

  @@index([disputeId])
  @@index([evidenceId])
  @@index([stakerUserId])
}

enum WithdrawalStatus {
  PENDING
  CONFIRMED
  FAILED
}

model Withdrawal {
  id             String            @id @default(uuid())
  userId         String
  user           User              @relation(fields: [userId], references: [id])
  disputeId      String?
  dispute        Dispute?          @relation(fields: [disputeId], references: [id])
  amountWei      String
  contractTxHash String?
  status         WithdrawalStatus  @default(PENDING)
  requestedAt    DateTime          @default(now())
  confirmedAt    DateTime?

  @@index([userId])
  @@index([disputeId])
}

// ---------------------------------------------------------------------------
// Contract transaction tracking, notifications, audit, settings
// ---------------------------------------------------------------------------

enum TransactionStatus {
  PENDING
  CONFIRMED
  FAILED
  REJECTED
}

model ContractTransaction {
  id               String             @id @default(uuid())
  txHash           String             @unique
  method           String
  relatedEntityType String
  relatedEntityId  String
  status           TransactionStatus  @default(PENDING)
  payload          Json?
  submittedByUserId String?
  submittedAt      DateTime           @default(now())
  confirmedAt      DateTime?

  @@index([relatedEntityType, relatedEntityId])
  @@index([status])
}

enum NotificationType {
  DISPUTE_CREATED
  EVIDENCE_SUBMITTED
  STAKE_ACCEPTED
  PARTICIPATION_DEADLINE_APPROACHING
  EVIDENCE_DEADLINE_APPROACHING
  ADJUDICATION_STARTED
  ADJUDICATION_COMPLETED
  REWARD_AVAILABLE
  SLASH_APPLIED
  WITHDRAWAL_COMPLETED
  TRANSACTION_FAILED
}

model Notification {
  id        String            @id @default(uuid())
  userId    String
  user      User              @relation(fields: [userId], references: [id])
  type      NotificationType
  payload   Json?
  readAt    DateTime?
  createdAt DateTime          @default(now())

  @@index([userId])
  @@index([userId, readAt])
}

model AuditLog {
  id           String   @id @default(uuid())
  actorUserId  String?
  actor        User?    @relation(fields: [actorUserId], references: [id])
  action       String
  targetType   String?
  targetId     String?
  metadata     Json?
  createdAt    DateTime @default(now())

  @@index([actorUserId])
  @@index([targetType, targetId])
}

model ApplicationSetting {
  key       String   @id
  value     Json
  updatedAt DateTime @updatedAt
}
"""

# ---------------------------------------------------------------------------
# database/schemas - human-readable ERD notes (the .prisma file above is
# the authoritative machine-readable schema)
# ---------------------------------------------------------------------------

FILES["database/schemas/ENTITY_OVERVIEW.md"] = """# Veritine database - entity overview

Authoritative schema: `database/schema.prisma`. This file is a
human-readable map of how entities relate; regenerate by hand if the
Prisma schema changes meaningfully.

## Identity & auth
`User` (1) --- (many) `Wallet`
`User` (1) --- (many) `Session`
`User` (1) --- (many) `SocialConnection`
`AuthNonce` is address-scoped, not user-scoped (issued before a user row
necessarily exists on first login).

## Disputes
`Dispute` (1) --- (many) `DisputePosition`
`Dispute` (1) --- (many) `Evidence`
`Dispute` (1) --- (many) `PositionStake`
`Dispute` (1) --- (0..1) `AdjudicationResult`
`DisputePosition` (1) --- (many) `Evidence`
`DisputePosition` (1) --- (many) `PositionStake`

## Evidence
`Evidence` (1) --- (many) `EvidenceSourceSnapshot` (cached fetch history)
`Evidence` (1) --- (many) `EvidenceStake` (submitter's own stake plus any
backers)
`Evidence` (1) --- (0..1) `EvidenceVerdict`

## Adjudication
`AdjudicationResult` (1) --- (many) `EvidenceVerdict`

## Economic outcomes
`RewardDistribution`, `SlashingRecord`, `Withdrawal` all reference
`Dispute` and `User`; `RewardDistribution.sourceType` distinguishes a
payout that originated from a position stake vs an evidence stake.

## Cross-cutting
`ContractTransaction` is not foreign-keyed to a single table -
`relatedEntityType` + `relatedEntityId` point at whichever row the
transaction concerns (Dispute, PositionStake, Evidence, EvidenceStake,
AdjudicationResult, Withdrawal), since a single transaction-tracking
shape is reused across every write path per the contract-client
requirements in the project readme.

## What is NOT authoritative here
Stake amounts, adjudication verdicts/conclusions, and reward/slash
amounts are always re-derived from the deployed GenLayer contract by the
indexing/reconciliation job. This database mirrors them for fast reads
and search; `Dispute.contractSyncedAt` / `ContractTransaction.status`
are how drift gets detected.
"""

# ---------------------------------------------------------------------------
# Seed script
# ---------------------------------------------------------------------------

FILES["database/seeds/seed.ts"] = """// Minimal, idempotent seed data for local development. Safe to rerun -
// uses upsert throughout. Run with: pnpm --filter @veritine/api db:seed

import { PrismaClient, DisputeCategory, DisputeStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const demoUser = await prisma.user.upsert({
    where: { primaryWalletAddress: '0x0000000000000000000000000000000000dEaD' },
    update: {},
    create: {
      primaryWalletAddress: '0x0000000000000000000000000000000000dEaD',
      displayName: 'Veritine Demo Account',
      wallets: {
        create: {
          address: '0x0000000000000000000000000000000000dEaD',
          chainId: 'genlayer-studionet',
          verifiedAt: new Date(),
        },
      },
    },
  });

  const existingDispute = await prisma.dispute.findFirst({
    where: { question: 'Did the demo sustainability report overstate emissions cuts?' },
  });

  if (!existingDispute) {
    await prisma.dispute.create({
      data: {
        question: 'Did the demo sustainability report overstate emissions cuts?',
        description: 'Seed dispute used to exercise the local development environment.',
        category: DisputeCategory.CLIMATE,
        creatorUserId: demoUser.id,
        status: DisputeStatus.DRAFT,
        participationDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        evidenceDeadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        minPositionStakeWei: '1000000000000000000',
        minEvidenceStakeWei: '500000000000000000',
        positions: {
          create: [{ label: 'Yes, materially overstated' }, { label: 'No, accurately reported' }],
        },
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log('Seed complete.');
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
"""

# ---------------------------------------------------------------------------
# NestJS: PrismaService + UsersModule (first real repository/service pair)
# ---------------------------------------------------------------------------

FILES["apps/api/src/shared/prisma.service.ts"] = """import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Wraps PrismaClient as a Nest-managed singleton so every module shares
 * one connection pool, and connects/disconnects in step with the app
 * lifecycle rather than lazily on first query.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
"""

FILES["apps/api/src/modules/users/users.module.ts"] = """import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma.service';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  controllers: [UsersController],
  providers: [PrismaService, UsersRepository, UsersService],
  exports: [UsersService],
})
export class UsersModule {}
"""

FILES["apps/api/src/modules/users/users.repository.ts"] = """import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../../shared/prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByWalletAddress(address: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { primaryWalletAddress: address } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  createWithWallet(address: string, chainId: string): Promise<User> {
    return this.prisma.user.create({
      data: {
        primaryWalletAddress: address,
        wallets: {
          create: { address, chainId, verifiedAt: new Date() },
        },
      },
    });
  }
}
"""

FILES["apps/api/src/modules/users/users.service.ts"] = """import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  /**
   * Finds the user for an authenticated wallet address, creating one on
   * first sign-in. This is the only place a User row gets created -
   * account creation is implicit in successful wallet authentication,
   * there is no separate "register" step for wallet-based auth.
   */
  async findOrCreateByWalletAddress(address: string, chainId: string): Promise<User> {
    const normalized = address.toLowerCase();
    const existing = await this.usersRepository.findByWalletAddress(normalized);
    if (existing) {
      return existing;
    }
    return this.usersRepository.createWithWallet(normalized, chainId);
  }

  getById(id: string): Promise<User | null> {
    return this.usersRepository.findById(id);
  }
}
"""

FILES["apps/api/src/modules/users/users.controller.ts"] = """import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  async getById(@Param('id') id: string) {
    const user = await this.usersService.getById(id);
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return {
      id: user.id,
      primaryWalletAddress: user.primaryWalletAddress,
      displayName: user.displayName,
      status: user.status,
      createdAt: user.createdAt,
    };
  }
}
"""


def main():
    for d in DIRS:
        os.makedirs(os.path.join(ROOT, d), exist_ok=True)

    written = []
    for rel_path, content in FILES.items():
        full_path = os.path.join(ROOT, rel_path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(content)
        written.append(rel_path)

    print(f"Wrote {len(written)} files:")
    for p in written:
        print(f"  + {p}")


if __name__ == "__main__":
    try:
        main()
    except OSError as e:
        print(f"ERROR: file operation failed: {e}", file=sys.stderr)
        sys.exit(1)
