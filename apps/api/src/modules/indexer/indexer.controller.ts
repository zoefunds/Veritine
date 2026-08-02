import { Controller, Post } from '@nestjs/common';
import { IndexerService } from './indexer.service';

/**
 * Manual sync trigger - useful for verification/debugging and for
 * forcing a fresh sync right after a write transaction finalizes,
 * rather than waiting for the next scheduled run.
 */
@Controller('indexer')
export class IndexerController {
  constructor(private readonly indexerService: IndexerService) {}

  @Post('sync')
  sync() {
    return this.indexerService.syncDisputes();
  }
}
