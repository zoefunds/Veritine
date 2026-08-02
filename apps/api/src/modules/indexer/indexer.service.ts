import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { VeritineReadClient } from '@veritine/contract-client';
import { DisputeCategory, DisputeStatus, SourceType, EvidenceOutcome, VerificationStatus } from '@prisma/client';
import { PrismaService } from '../../shared/prisma.service';
import { UsersService } from '../users/users.service';

// @veritine/contract-client is an ESM package (genlayer-js is ESM-only).
// This service compiles to CommonJS. A plain `import()` here would get
// downleveled by tsc into `Promise.resolve().then(() => require(...))`,
// which still crashes at runtime with ERR_REQUIRE_ESM since require()
// itself cannot load ESM. Constructing the import via `new Function`
// hides it from TypeScript's static transform, so Node's own native
// dynamic import (supported in CommonJS files since Node 12) runs
// unmodified at runtime.
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const dynamicImport = new Function('specifier', 'return import(specifier)') as (
  specifier: string,
) => Promise<typeof import('@veritine/contract-client')>;

async function loadReadClient(): Promise<typeof VeritineReadClient> {
  const mod = await dynamicImport('@veritine/contract-client');
  return mod.VeritineReadClient;
}

const VALID_CATEGORIES = new Set(Object.values(DisputeCategory));
const VALID_STATUSES = new Set(Object.values(DisputeStatus));
const VALID_SOURCE_TYPES = new Set(Object.values(SourceType));
const VALID_EVIDENCE_OUTCOMES = new Set(Object.values(EvidenceOutcome));

// The contract's activity note for a position stake is the literal string
// `f"position {position_index}"` - see _apply_position_stake's _log call.
const STAKE_POSITION_NOTE = /^position (\d+)$/;
// Bounds how many pages of get_activity we'll walk per dispute sync -
// each page is 1 RPC call, so this caps the cost of a single sync at a
// predictable number of reads even for a dispute with heavy activity.
const MAX_ACTIVITY_PAGES = 10;
const ACTIVITY_PAGE_SIZE = 100;

interface ChainPosition {
  index: number;
  label: string;
  total_stake_wei: number;
}

interface ChainDispute {
  id: number;
  creator: string;
  question: string;
  description: string;
  category: string;
  created_ts: number;
  participation_deadline_ts: number;
  evidence_deadline_ts: number;
  status: string;
  min_position_stake_wei: number;
  min_evidence_stake_wei: number;
  total_stake_wei: number;
  position_count: number;
  evidence_count: number;
  winning_position_index: number;
  conclusion: string;
  reasoning_summary: string;
  adjudicated_at: number;
  positions?: ChainPosition[];
}

// Matches _evidence_dict's return shape (contracts/veritine_contract.py).
interface ChainEvidence {
  id: number;
  dispute_id: number;
  position_index: number;
  submitter: string;
  source_url: string;
  source_title: string;
  publisher: string;
  publication_date: string;
  summary: string;
  source_type: string;
  total_stake_wei: number;
  submitted_at: number;
  adjudicated: boolean;
  outcome: string | null;
  reasoning_summary: string | null;
}

interface ChainActivityEvent {
  kind: string;
  actor: string;
  amount_wei: number;
  ts: number;
  note: string;
}

/**
 * Indexes the deployed Veritine contract's dispute state into Postgres so
 * the API can serve fast, searchable reads. This is a MIRROR, never the
 * source of truth - every write here is derived from a fresh contract
 * read, and nothing in this service ever computes stakes, verdicts, or
 * payouts independently. See docs/architecture/PHASE_1_ARCHITECTURE.md §4.
 */
@Injectable()
export class IndexerService {
  private readonly logger = new Logger(IndexerService.name);
  private readClient: VeritineReadClient | null = null;
  private syncing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  private async getReadClient(): Promise<VeritineReadClient> {
    if (!this.readClient) {
      const ReadClientCtor = await loadReadClient();
      this.readClient = new ReadClientCtor({
        contractAddress: process.env.GENLAYER_CONTRACT_ADDRESS,
        network: process.env.GENLAYER_NETWORK,
      });
    }
    return this.readClient;
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async scheduledSync(): Promise<void> {
    await this.syncDisputes();
  }

  /**
   * Reads every dispute from the deployed contract and upserts it into
   * Postgres, keyed by contractDisputeId. Idempotent and safe to call
   * repeatedly (via cron or the manual trigger endpoint).
   */
  async syncDisputes(): Promise<{ synced: number; total: number }> {
    if (this.syncing) {
      this.logger.warn('Sync already in progress, skipping this run');
      return { synced: 0, total: 0 };
    }
    this.syncing = true;
    try {
      const readClient = await this.getReadClient();
      const total = await readClient.getDisputeCount();
      let synced = 0;
      for (let id = 0; id < total; id += 1) {
        try {
          await this.syncOneDispute(readClient, id);
          synced += 1;
        } catch (error) {
          this.logger.error(`Failed to sync dispute ${id}: ${(error as Error).message}`);
        }
      }
      this.logger.log(`Indexer sync complete: ${synced}/${total} disputes`);
      return { synced, total };
    } finally {
      this.syncing = false;
    }
  }

  /**
   * Syncs a single dispute by contract id. Unlike syncDisputes(), this is
   * bounded to exactly 2 RPC calls regardless of how many disputes exist,
   * so it's safe to expose without the internal API key - used by the
   * frontend right after a create_dispute (or position stake) write
   * finalizes, so the new/updated dispute is visible immediately instead
   * of waiting for the next 5-minute cron sync.
   */
  async syncOneDisputeById(id: number): Promise<void> {
    const readClient = await this.getReadClient();
    await this.syncOneDispute(readClient, id);
  }

  private async syncOneDispute(readClient: VeritineReadClient, id: number): Promise<void> {
    const chainDispute = (await readClient.getDispute(id)) as unknown as ChainDispute;

    const creator = await this.usersService.findOrCreateByWalletAddress(
      chainDispute.creator,
      'genlayer-studionet',
    );

    const category = VALID_CATEGORIES.has(chainDispute.category as DisputeCategory)
      ? (chainDispute.category as DisputeCategory)
      : DisputeCategory.OTHER;
    const status = VALID_STATUSES.has(chainDispute.status as DisputeStatus)
      ? (chainDispute.status as DisputeStatus)
      : DisputeStatus.ACTIVE;

    const dispute = await this.prisma.dispute.upsert({
      where: { contractDisputeId: String(chainDispute.id) },
      create: {
        contractDisputeId: String(chainDispute.id),
        question: chainDispute.question,
        description: chainDispute.description,
        category,
        creatorUserId: creator.id,
        status,
        participationDeadline: new Date(chainDispute.participation_deadline_ts * 1000),
        evidenceDeadline: new Date(chainDispute.evidence_deadline_ts * 1000),
        minPositionStakeWei: String(chainDispute.min_position_stake_wei),
        minEvidenceStakeWei: String(chainDispute.min_evidence_stake_wei),
        totalStakeWei: String(chainDispute.total_stake_wei),
        contractSyncedAt: new Date(),
      },
      update: {
        question: chainDispute.question,
        description: chainDispute.description,
        category,
        status,
        totalStakeWei: String(chainDispute.total_stake_wei),
        contractSyncedAt: new Date(),
      },
    });

    const positions = await readClient.getPositions(id);
    const positionIdByIndex = new Map<number, string>();
    for (const position of positions as unknown as ChainPosition[]) {
      const dbPosition = await this.prisma.disputePosition.upsert({
        where: {
          disputeId_contractPositionId: {
            disputeId: dispute.id,
            contractPositionId: String(position.index),
          },
        },
        create: {
          disputeId: dispute.id,
          contractPositionId: String(position.index),
          label: position.label,
          totalStakeWei: String(position.total_stake_wei),
        },
        update: {
          totalStakeWei: String(position.total_stake_wei),
        },
      });
      positionIdByIndex.set(position.index, dbPosition.id);
    }

    await this.syncEvidence(readClient, id, dispute.id, positionIdByIndex);
    await this.syncPositionStakes(readClient, id, dispute.id, positionIdByIndex);
  }

  /**
   * Evidence was previously never synced at all - the /disputes/:id API
   * response's `evidence` array was always empty regardless of what had
   * actually been submitted on-chain, because nothing ever wrote Evidence
   * rows into Postgres.
   */
  private async syncEvidence(
    readClient: VeritineReadClient,
    contractDisputeId: number,
    disputeId: string,
    positionIdByIndex: Map<number, string>,
  ): Promise<void> {
    const evidenceList = (await readClient.getEvidenceForDispute(contractDisputeId)) as unknown as ChainEvidence[];
    for (const item of evidenceList) {
      const positionId = positionIdByIndex.get(item.position_index);
      if (!positionId) continue;

      const submitter = await this.usersService.findOrCreateByWalletAddress(item.submitter, 'genlayer-studionet');
      const sourceType = VALID_SOURCE_TYPES.has(item.source_type as SourceType)
        ? (item.source_type as SourceType)
        : SourceType.REPUTABLE_JOURNALISM;
      const outcome =
        item.outcome && VALID_EVIDENCE_OUTCOMES.has(item.outcome as EvidenceOutcome)
          ? (item.outcome as EvidenceOutcome)
          : null;

      await this.prisma.evidence.upsert({
        where: { contractEvidenceId: String(item.id) },
        create: {
          contractEvidenceId: String(item.id),
          disputeId,
          positionId,
          submitterUserId: submitter.id,
          sourceUrl: item.source_url,
          sourceTitle: item.source_title,
          publisher: item.publisher,
          publicationDate: item.publication_date ? new Date(item.publication_date) : null,
          summary: item.summary,
          sourceType,
          submitterStakeWei: String(item.total_stake_wei),
          totalStakeWei: String(item.total_stake_wei),
          verificationStatus: item.adjudicated ? VerificationStatus.ADJUDICATED : VerificationStatus.PENDING,
          outcome,
          reasoningSummary: item.reasoning_summary,
          submittedAt: new Date(item.submitted_at * 1000),
        },
        update: {
          totalStakeWei: String(item.total_stake_wei),
          verificationStatus: item.adjudicated ? VerificationStatus.ADJUDICATED : VerificationStatus.PENDING,
          outcome,
          reasoningSummary: item.reasoning_summary,
        },
      });
    }
  }

  /**
   * PositionStake rows were previously never written either - there was
   * no per-user record of who staked what, only the aggregate total on
   * DisputePosition. The contract doesn't expose "list every staker" for
   * a position directly, so we derive the set of stakers from the
   * append-only activity log (get_activity), then read each staker's
   * authoritative *current* cumulative amount via get_position_stake -
   * the log gives us *who*, the direct read gives us the correct *how
   * much* even if they staked more than once.
   */
  private async syncPositionStakes(
    readClient: VeritineReadClient,
    contractDisputeId: number,
    disputeId: string,
    positionIdByIndex: Map<number, string>,
  ): Promise<void> {
    const stakersByPositionIndex = new Map<number, Set<string>>();
    let offset = 0;
    for (let page = 0; page < MAX_ACTIVITY_PAGES; page += 1) {
      const events = (await readClient.getActivity(
        contractDisputeId,
        offset,
        ACTIVITY_PAGE_SIZE,
      )) as unknown as ChainActivityEvent[];
      for (const evt of events) {
        if (evt.kind !== 'STAKE_POSITION') continue;
        const match = STAKE_POSITION_NOTE.exec(evt.note);
        if (!match) continue;
        const positionIndex = Number(match[1]);
        const set = stakersByPositionIndex.get(positionIndex) ?? new Set<string>();
        set.add(evt.actor);
        stakersByPositionIndex.set(positionIndex, set);
      }
      if (events.length < ACTIVITY_PAGE_SIZE) break;
      offset += ACTIVITY_PAGE_SIZE;
    }

    for (const [positionIndex, stakerAddresses] of stakersByPositionIndex) {
      const positionId = positionIdByIndex.get(positionIndex);
      if (!positionId) continue;

      for (const address of stakerAddresses) {
        const staker = await this.usersService.findOrCreateByWalletAddress(address, 'genlayer-studionet');
        const current = await readClient.getPositionStake(contractDisputeId, positionIndex, address);
        const amountWei = String((current as unknown as { amount_wei: number }).amount_wei);
        if (amountWei === '0') continue;

        const existing = await this.prisma.positionStake.findFirst({
          where: { disputeId, positionId, stakerUserId: staker.id },
        });
        if (existing) {
          if (existing.amountWei !== amountWei) {
            await this.prisma.positionStake.update({ where: { id: existing.id }, data: { amountWei } });
          }
        } else {
          await this.prisma.positionStake.create({
            data: { disputeId, positionId, stakerUserId: staker.id, amountWei, status: 'CONFIRMED' },
          });
        }
      }
    }
  }
}
