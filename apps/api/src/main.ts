import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { loadBackendEnv } from '@veritine/shared-config';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  // Fail fast on missing/invalid configuration before the app boots.
  const env = loadBackendEnv();

  const app = await NestFactory.create(AppModule);

  // Secure headers (CSP, X-Frame-Options, X-Content-Type-Options, etc.).
  // This is an API with no server-rendered HTML of its own, so a strict
  // default-src 'none' CSP is safe and does not need script/style
  // allowances the way apps/web's pages do.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );

  app.use(cookieParser());

  // Explicit request-size caps - the largest legitimate payload this API
  // accepts is an evidence summary (capped at 2000 chars client-side and
  // re-validated server-side), nowhere near this ceiling. Defends against
  // oversized-body DoS attempts.
  app.use(json({ limit: '256kb' }));
  app.use(urlencoded({ extended: true, limit: '256kb' }));

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
