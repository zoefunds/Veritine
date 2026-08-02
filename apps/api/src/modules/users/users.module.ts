import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma.service';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  controllers: [UsersController],
  providers: [PrismaService, UsersRepository, UsersService],
  exports: [UsersService],
})
export class UsersModule {}
