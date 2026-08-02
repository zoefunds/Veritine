import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma.service';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SessionAuthGuard } from './session-auth.guard';

// Rate limiting is registered globally in AppModule (ThrottlerModule.forRoot
// with a 'default' throttler). AuthController overrides it per-route via
// @Throttle() for the nonce-issuance endpoint specifically, since that's
// the one most worth protecting from abuse (each call writes a row and
// could be spammed to grow the table or brute-force-guess valid nonces).
@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [PrismaService, AuthService, SessionAuthGuard],
  exports: [AuthService, SessionAuthGuard],
})
export class AuthModule {}
