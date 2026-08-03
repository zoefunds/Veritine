import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma.service';
import { IndexerModule } from '../indexer/indexer.module';
import { ResolverService } from './resolver.service';

@Module({
  imports: [IndexerModule],
  providers: [PrismaService, ResolverService],
})
export class ResolverModule {}
