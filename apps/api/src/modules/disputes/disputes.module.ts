import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma.service';
import { DisputesService } from './disputes.service';
import { DisputesController } from './disputes.controller';

@Module({
  controllers: [DisputesController],
  providers: [PrismaService, DisputesService],
  exports: [DisputesService],
})
export class DisputesModule {}
