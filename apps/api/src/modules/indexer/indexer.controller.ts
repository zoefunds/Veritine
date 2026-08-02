import { Controller, Post, UseGuards } from '@nestjs/common';
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
}
