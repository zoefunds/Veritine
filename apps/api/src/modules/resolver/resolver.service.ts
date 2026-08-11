import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { VeritineWriteClient } from '@veritine/contract-client';
import { DisputeStatus } from '@prisma/client';
import { PrismaService } from '../../shared/prisma.service';
import { IndexerService } from '../indexer/indexer.service';

// Same dynamic-import workaround as IndexerService - @veritine/contract-client
// is ESM-only, this service compiles to CommonJS. See indexer.service.ts for
// the full explanation.
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const dynamicImport = new Function('specifier', 'return import(specifier)') as (
  specifier: string,
) => Promise<typeof import('@veritine/contract-client')>;

async function loadWriteClient(): Promise<typeof VeritineWriteClient> {
  const mod = await dynamicImport('@veritine/contract-client');
  return mod.VeritineWriteClient;
}

const ADJUDICABLE_STATUSES: DisputeStatus[] = [DisputeStatus.ACTIVE, DisputeStatus.EVIDENCE_CLOSED];

/**
 * Automatically calls request_adjudication (permissionless on the
 * contract) for any dispute whose evidence deadline has passed and
 * hasn't been settled yet. Without this, adjudication only happens if
 * some human remembers to trigger it - see
 * docs/decisions/0004-automated-adjudication-resolver.md.
 *
 * Uses a dedicated, platform-held hot wallet (RESOLVER_PRIVATE_KEY) -
 * never a user's own key. If that env var isn't set (e.g. local dev),
 * the resolver logs once and no-ops rather than crashing the app, since
 * automated resolution is an operational nicety, not a requirement for
 * the platform to function (anyone can still call request_adjudication
 * manually, including via the frontend's "Request Adjudication" button).
 */
@Injectable()
export class ResolverService {
  private readonly logger = new Logger(ResolverService.name);
  private writeClient: VeritineWriteClient | null = null;
  private warnedMissingKey = false;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly indexerService: IndexerService,
  ) {}

  private async getWriteClient(): Promise<VeritineWriteClient | null> {
    const privateKey = process.env.RESOLVER_PRIVATE_KEY;
    if (!privateKey) {
      if (!this.warnedMissingKey) {
        this.logger.warn('RESOLVER_PRIVATE_KEY not set - automated adjudication is disabled');
        this.warnedMissingKey = true;
      }
      return null;
    }
    if (!this.writeClient) {
      const WriteClientCtor = await loadWriteClient();
      this.writeClient = new WriteClientCtor({
        contractAddress: process.env.GENLAYER_CONTRACT_ADDRESS,
        network: process.env.GENLAYER_NETWORK,
        privateKey: privateKey as `0x${string}`,
      });
    }
    return this.writeClient;
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async resolveOverdueDisputes(): Promise<void> {
    if (this.running) {
      this.logger.warn('Resolver run already in progress, skipping this tick');
      return;
    }
    const writeClient = await this.getWriteClient();
    if (!writeClient) return;

    this.running = true;
    try {
      const overdue = await this.prisma.dispute.findMany({
        where: {
          status: { in: ADJUDICABLE_STATUSES },
          evidenceDeadline: { lt: new Date() },
          adjudicationResult: null,
        },
        select: { contractDisputeId: true, question: true },
      });

      if (overdue.length === 0) return;
      this.logger.log(`Found ${overdue.length} dispute(s) past their evidence deadline, requesting adjudication`);

      for (const dispute of overdue) {
        if (!dispute.contractDisputeId) continue;
        const id = Number(dispute.contractDisputeId);
        try {
          const submitted = await writeClient.requestAdjudication(id);
          const result = await submitted.waitForFinality();
          if (!result.succeeded) {
            this.logger.error(`request_adjudication for dispute ${id} finalized but execution failed`);
            continue;
          }
          this.logger.log(`Adjudicated dispute ${id} ("${dispute.question}")`);
          // Mark the row ADJUDICATING locally right away, before the indexer
          // sync below runs. syncOneDisputeById does an RPC round-trip and
          // can lag - without this, the next 5-minute tick's query (still
          // seeing the old status + null adjudicationResult) re-selects the
          // same dispute and calls request_adjudication again, which the
          // contract correctly rejects as "not adjudicable" but which is
          // pure noise. The subsequent sync overwrites this with whatever
          // the contract's real post-adjudication status is.
          await this.prisma.dispute.update({
            where: { contractDisputeId: String(id) },
            data: { status: DisputeStatus.ADJUDICATING },
          });
          await this.indexerService.syncOneDisputeById(id);
        } catch (error) {
          this.logger.error(`Failed to adjudicate dispute ${id}: ${(error as Error).message}`);
        }
      }
    } finally {
      this.running = false;
    }
  }
}
