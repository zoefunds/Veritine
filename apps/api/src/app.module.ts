import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [HealthModule, UsersModule],
})
export class AppModule {}
