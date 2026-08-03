import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { IndexerModule } from './modules/indexer/indexer.module';
import { DisputesModule } from './modules/disputes/disputes.module';
import { ResolverModule } from './modules/resolver/resolver.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    // Global rate limiting - a sensible default for every route, with
    // per-route overrides via @Throttle() where a tighter or looser limit
    // is warranted (see AuthController for nonce issuance, IndexerController
    // for the manual sync trigger).
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 60 }]),
    HealthModule,
    UsersModule,
    AuthModule,
    IndexerModule,
    DisputesModule,
    ResolverModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
