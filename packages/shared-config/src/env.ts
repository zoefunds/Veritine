// Environment-variable validation. Every app (apps/web, apps/api) must
// call the relevant loader at startup and fail fast with a clear error
// if required configuration is missing - never fall back to silent
// defaults for security-relevant values.

import { z } from 'zod';

const backendEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET must be at least 16 characters'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  NONCE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  GENLAYER_NETWORK: z.string().min(1, 'GENLAYER_NETWORK is required'),
  GENLAYER_RPC_URL: z.string().url('GENLAYER_RPC_URL must be a valid URL'),
  GENLAYER_CONTRACT_ADDRESS: z.string().optional(),
  GENLAYER_CHAIN_ID: z.string().optional(),
  FRONTEND_URL: z.string().url('FRONTEND_URL must be a valid URL'),
  API_URL: z.string().url('API_URL must be a valid URL'),
  // Optional: gates POST /indexer/sync, which fans out into real GenLayer
  // RPC calls against a 5,000/day quota. Strongly recommended in production;
  // if unset, the endpoint falls back to rate-limiting only (see
  // InternalApiKeyGuard).
  INTERNAL_API_KEY: z.string().min(16).optional(),
});

export type BackendEnv = z.infer<typeof backendEnvSchema>;

/**
 * Parses and validates process.env for backend services. Throws a single
 * readable error listing every problem found, rather than failing on the
 * first missing variable one at a time.
 */
export function loadBackendEnv(source: NodeJS.ProcessEnv = process.env): BackendEnv {
  const result = backendEnvSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid or missing environment configuration:\n${issues}`);
  }
  return result.data;
}

const frontendEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url('NEXT_PUBLIC_API_URL must be a valid URL'),
  NEXT_PUBLIC_GENLAYER_NETWORK: z.string().min(1),
  NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS: z.string().optional(),
  NEXT_PUBLIC_GENLAYER_CHAIN_ID: z.string().optional(),
  NEXT_PUBLIC_REOWN_PROJECT_ID: z.string().min(1, 'NEXT_PUBLIC_REOWN_PROJECT_ID is required for wallet connect'),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

export type FrontendEnv = z.infer<typeof frontendEnvSchema>;

/** Parses and validates the NEXT_PUBLIC_* variables available to the browser bundle. */
export function loadFrontendEnv(source: NodeJS.ProcessEnv = process.env): FrontendEnv {
  const result = frontendEnvSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid or missing frontend environment configuration:\n${issues}`);
  }
  return result.data;
}
