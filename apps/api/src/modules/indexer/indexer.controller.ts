import { BadRequestException, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IndexerService } from './indexer.service';
import { InternalApiKeyGuard } from './internal-api-key.guard';

/**
 * Manual sync trigger - useful for verification/debugging and for
 * forcing a fresh sync right after a write transaction finalizes,
 * rather than waiting for the next scheduled run.
 *
 * Protected by InternalApiKeyGuard (see that file for why - this endpoint
 * fans out into real GenLayer RPC calls against a 5,000/day quota) and
 * throttled far more tightly than the global default.
 */
@Controller('indexer')
export class IndexerController {
  constructor(private readonly indexerService: IndexerService) {}

  @UseGuards(InternalApiKeyGuard)
  @Throttle({ default: { limit: 2, ttl: 300_000 } })
  @Post('sync')
  sync() {
    return this.indexerService.syncDisputes();
  }

  /**
   * Public single-dispute sync, safe to call directly from the frontend
   * right after a write transaction finalizes. Cost is fixed at 2 RPC
   * calls regardless of platform size (unlike /sync, which fans out over
   * every dispute), so it doesn't need the internal API key - only a
   * per-IP rate limit to prevent abuse.
   */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('sync/:contractDisputeId')
  async syncOne(@Param('contractDisputeId') contractDisputeId: string) {
    const id = Number(contractDisputeId);
    if (!Number.isInteger(id) || id < 0) {
      throw new BadRequestException('contractDisputeId must be a non-negative integer');
    }
    await this.indexerService.syncOneDisputeById(id);
    return { synced: true, contractDisputeId: id };
  }
}
