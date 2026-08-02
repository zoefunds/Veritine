import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaService } from '../../shared/prisma.service';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SessionAuthGuard } from './session-auth.guard';

@Module({
  imports: [
    UsersModule,
    ThrottlerModule.forRoot([
      // Nonce issuance is the endpoint most worth protecting from abuse -
      // each request writes a row and could be spammed to grow the table
      // or brute-force-guess valid nonces for an address.
      { name: 'auth', ttl: 60_000, limit: 20 },
    ]),
  ],
  controllers: [AuthController],
  providers: [PrismaService, AuthService, SessionAuthGuard],
  exports: [AuthService, SessionAuthGuard],
})
export class AuthModule {}
