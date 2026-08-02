# Veritine database - entity overview

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
