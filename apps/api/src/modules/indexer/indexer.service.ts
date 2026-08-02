import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { VeritineReadClient } from '@veritine/contract-client';
import { DisputeCategory, DisputeStatus } from '@prisma/client';
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
    for (const position of positions as unknown as ChainPosition[]) {
      await this.prisma.disputePosition.upsert({
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
    }
  }
}
