import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { loadBackendEnv } from '@veritine/shared-config';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  // Fail fast on missing/invalid configuration before the app boots.
  const env = loadBackendEnv();

  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.enableCors({ origin: env.FRONTEND_URL, credentials: true });
  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`Veritine API listening on port ${port} (${env.NODE_ENV})`);
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Fatal error during bootstrap:', error);
  process.exit(1);
});
