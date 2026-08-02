import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma.service';
import { UsersModule } from '../users/users.module';
import { IndexerService } from './indexer.service';
import { IndexerController } from './indexer.controller';

@Module({
  imports: [UsersModule],
  controllers: [IndexerController],
  providers: [PrismaService, IndexerService],
  exports: [IndexerService],
})
export class IndexerModule {}
