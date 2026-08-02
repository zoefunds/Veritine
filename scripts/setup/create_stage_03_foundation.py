#!/usr/bin/env python3
"""
Veritine - Stage 03: Foundation.

Creates shared TypeScript packages (types, config/env-validation, validation
schemas), the Next.js app skeleton, and the NestJS app skeleton, plus root
TypeScript/lint/format tooling. No feature code yet (disputes/evidence/etc
land in later phases) - this stage is the shared foundation everything
else builds on.

Run from: /Users/macbook/source-stake  (the project root)
Command:  python3 scripts/setup/create_stage_03_foundation.py

Safe to rerun: yes, overwrites the files it manages (all listed below).
Does not touch files outside this stage's scope.
"""

import os
import sys

ROOT = os.getcwd()

DIRS = [
    "packages/shared-types/src",
    "packages/shared-config/src",
    "packages/validation/src",
    "apps/web/app",
    "apps/web/public",
    "apps/api/src/modules/health",
    "apps/api/src/config",
    "apps/api/src/shared",
]

FILES = {}

# ---------------------------------------------------------------------------
# Root tooling
# ---------------------------------------------------------------------------

FILES["tsconfig.base.json"] = """{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "CommonJS",
    "moduleResolution": "Node",
    "declaration": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true
  }
}
"""

FILES[".prettierrc"] = """{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100
}
"""

FILES[".eslintrc.cjs"] = """module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  env: {
    node: true,
    es2022: true,
  },
  ignorePatterns: ['dist/', '.next/', 'node_modules/'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
};
"""

# ---------------------------------------------------------------------------
# packages/shared-types
# ---------------------------------------------------------------------------

FILES["packages/shared-types/package.json"] = """{
  "name": "@veritine/shared-types",
  "version": "0.1.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  }
}
"""

FILES["packages/shared-types/tsconfig.json"] = """{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
"""

FILES["packages/shared-types/src/index.ts"] = """// Domain types shared across the Veritine frontend, backend, and contract
// client. This is the single source of truth for enum values that must
// stay in sync with the GenLayer Intelligent Contract's state machine and
// economic model - see docs/architecture/PHASE_1_ARCHITECTURE.md.

/** Dispute lifecycle state machine (contract-authoritative). */
export enum DisputeStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  EVIDENCE_OPEN = 'EVIDENCE_OPEN',
  EVIDENCE_CLOSED = 'EVIDENCE_CLOSED',
  READY_FOR_ADJUDICATION = 'READY_FOR_ADJUDICATION',
  ADJUDICATING = 'ADJUDICATING',
  ADJUDICATED = 'ADJUDICATED',
  REWARDING = 'REWARDING',
  FINALIZED = 'FINALIZED',
  CANCELLED = 'CANCELLED',
  INVALID = 'INVALID',
  INCONCLUSIVE = 'INCONCLUSIVE',
}

/** Overall dispute conclusion produced by adjudication. */
export enum DisputeConclusion {
  POSITION_SUPPORTED = 'POSITION_SUPPORTED',
  PARTIALLY_SUPPORTED = 'PARTIALLY_SUPPORTED',
  CLAIM_MATERIALLY_MISLEADING = 'CLAIM_MATERIALLY_MISLEADING',
  CLAIM_UNSUPPORTED = 'CLAIM_UNSUPPORTED',
  EVIDENCE_INSUFFICIENT = 'EVIDENCE_INSUFFICIENT',
  INCONCLUSIVE = 'INCONCLUSIVE',
  QUESTION_INVALID = 'QUESTION_INVALID',
}

/**
 * Per-evidence adjudication outcome. Maps 1:1 to the approved economic
 * model in docs/architecture/PHASE_1_ARCHITECTURE.md section 10 - the
 * exact percentages live in @veritine/shared-config's ECONOMIC_MODEL
 * constant, not here, so there is one place to change them.
 */
export enum EvidenceOutcome {
  STRONGLY_SUPPORTED = 'STRONGLY_SUPPORTED',
  CREDIBLE_AND_RELEVANT = 'CREDIBLE_AND_RELEVANT',
  CREDIBLE_BUT_LIMITED = 'CREDIBLE_BUT_LIMITED',
  INCONCLUSIVE = 'INCONCLUSIVE',
  OUTDATED_NOT_DECEPTIVE = 'OUTDATED_NOT_DECEPTIVE',
  WEAK_OR_INCOMPLETE = 'WEAK_OR_INCOMPLETE',
  MATERIALLY_IRRELEVANT = 'MATERIALLY_IRRELEVANT',
  MISLEADING = 'MISLEADING',
  FABRICATED_OR_UNVERIFIABLE = 'FABRICATED_OR_UNVERIFIABLE',
  MALICIOUSLY_MANIPULATED = 'MALICIOUSLY_MANIPULATED',
}

export enum SourceType {
  PRIMARY_SOURCE = 'PRIMARY_SOURCE',
  OFFICIAL_REPORT = 'OFFICIAL_REPORT',
  REGULATORY_FILING = 'REGULATORY_FILING',
  GOVERNMENT_RECORD = 'GOVERNMENT_RECORD',
  PEER_REVIEWED_RESEARCH = 'PEER_REVIEWED_RESEARCH',
  INDEPENDENT_INVESTIGATION = 'INDEPENDENT_INVESTIGATION',
  REPUTABLE_JOURNALISM = 'REPUTABLE_JOURNALISM',
  ORGANIZATIONAL_PUBLICATION = 'ORGANIZATIONAL_PUBLICATION',
  COMMUNITY_GENERATED = 'COMMUNITY_GENERATED',
  SOCIAL_MEDIA = 'SOCIAL_MEDIA',
  ARCHIVED_SOURCE = 'ARCHIVED_SOURCE',
  ANONYMOUS_SOURCE = 'ANONYMOUS_SOURCE',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
  REJECTED = 'REJECTED',
}

export interface DisputePosition {
  id: string;
  disputeId: string;
  label: string;
  totalStakeWei: string;
}

export interface Dispute {
  id: string;
  question: string;
  description: string;
  category: string;
  creatorAddress: string;
  status: DisputeStatus;
  positions: DisputePosition[];
  participationDeadline: string; // ISO timestamp
  evidenceDeadline: string; // ISO timestamp
  minPositionStakeWei: string;
  minEvidenceStakeWei: string;
  totalStakeWei: string;
  createdAt: string;
}

export interface EvidenceSubmission {
  id: string;
  disputeId: string;
  positionId: string;
  submitterAddress: string;
  sourceUrl: string;
  sourceTitle: string;
  publisher: string;
  publicationDate: string | null;
  retrievalDate: string;
  summary: string;
  sourceType: SourceType;
  stakeWei: string;
  submittedAt: string;
  outcome: EvidenceOutcome | null;
  reasoningSummary: string | null;
}

export interface AdjudicationResult {
  disputeId: string;
  conclusion: DisputeConclusion;
  winningPositionId: string | null;
  reasoningSummary: string;
  evidenceOutcomes: Array<{ evidenceId: string; outcome: EvidenceOutcome }>;
  adjudicatedAt: string;
  contractTxHash: string;
}

export interface ContractTransaction {
  hash: string;
  method: string;
  status: TransactionStatus;
  submittedAt: string;
  confirmedAt: string | null;
}
"""

# ---------------------------------------------------------------------------
# packages/shared-config
# ---------------------------------------------------------------------------

FILES["packages/shared-config/package.json"] = """{
  "name": "@veritine/shared-config",
  "version": "0.1.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "dependencies": {
    "@veritine/shared-types": "workspace:*",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^22.7.5"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  }
}
"""

FILES["packages/shared-config/tsconfig.json"] = """{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
"""

FILES["packages/shared-config/src/economics.ts"] = """// Single source of truth for the approved Veritine economic model.
// See docs/architecture/PHASE_1_ARCHITECTURE.md section 10 for the
// rationale. Both the backend indexer/display logic and the contract
// test suite should reference these values rather than hardcoding
// percentages in multiple places.

import { EvidenceOutcome } from '@veritine/shared-types';

/** Basis points (1/100th of a percent). 10_000 bps = 100%. */
export const BPS_DENOMINATOR = 10_000;

/**
 * Slash percentage (in basis points) applied to an evidence stake for
 * each adjudicated outcome. 0 means the stake is fully refunded (and,
 * for the first two tiers, eligible for a proportional reward share).
 */
export const EVIDENCE_OUTCOME_SLASH_BPS: Record<EvidenceOutcome, number> = {
  [EvidenceOutcome.STRONGLY_SUPPORTED]: 0,
  [EvidenceOutcome.CREDIBLE_AND_RELEVANT]: 0,
  [EvidenceOutcome.CREDIBLE_BUT_LIMITED]: 0,
  [EvidenceOutcome.INCONCLUSIVE]: 0,
  [EvidenceOutcome.OUTDATED_NOT_DECEPTIVE]: 0,
  [EvidenceOutcome.WEAK_OR_INCOMPLETE]: 2_500,
  [EvidenceOutcome.MATERIALLY_IRRELEVANT]: 5_000,
  [EvidenceOutcome.MISLEADING]: 7_500,
  [EvidenceOutcome.FABRICATED_OR_UNVERIFIABLE]: 10_000,
  [EvidenceOutcome.MALICIOUSLY_MANIPULATED]: 10_000,
};

/** Outcomes eligible for a proportional share of the reward pool. */
export const REWARD_ELIGIBLE_OUTCOMES: ReadonlySet<EvidenceOutcome> = new Set([
  EvidenceOutcome.STRONGLY_SUPPORTED,
  EvidenceOutcome.CREDIBLE_AND_RELEVANT,
]);

/** Outcome that additionally flags the submitter's address in contract state. */
export const FLAGGING_OUTCOMES: ReadonlySet<EvidenceOutcome> = new Set([
  EvidenceOutcome.MALICIOUSLY_MANIPULATED,
]);

/** Share of the slashed-stake pool paid to winning-side stakers (basis points). */
export const SLASH_POOL_WINNER_SHARE_BPS = 9_000; // 90%

/** Share of the slashed-stake pool routed to the protocol treasury (basis points). */
export const SLASH_POOL_TREASURY_SHARE_BPS = 1_000; // 10%

/** Protocol fee on reward payouts only - never on refunds or returned principal. */
export const PROTOCOL_FEE_BPS = 200; // 2%
"""

FILES["packages/shared-config/src/env.ts"] = """// Environment-variable validation. Every app (apps/web, apps/api) must
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
      .join('\\n');
    throw new Error(`Invalid or missing environment configuration:\\n${issues}`);
  }
  return result.data;
}

const frontendEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url('NEXT_PUBLIC_API_URL must be a valid URL'),
  NEXT_PUBLIC_GENLAYER_NETWORK: z.string().min(1),
  NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS: z.string().optional(),
  NEXT_PUBLIC_GENLAYER_CHAIN_ID: z.string().optional(),
});

export type FrontendEnv = z.infer<typeof frontendEnvSchema>;

/** Parses and validates the NEXT_PUBLIC_* variables available to the browser bundle. */
export function loadFrontendEnv(source: NodeJS.ProcessEnv = process.env): FrontendEnv {
  const result = frontendEnvSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\\n');
    throw new Error(`Invalid or missing frontend environment configuration:\\n${issues}`);
  }
  return result.data;
}
"""

FILES["packages/shared-config/src/index.ts"] = """export * from './env';
export * from './economics';
"""

# ---------------------------------------------------------------------------
# packages/validation
# ---------------------------------------------------------------------------

FILES["packages/validation/package.json"] = """{
  "name": "@veritine/validation",
  "version": "0.1.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "dependencies": {
    "zod": "^3.23.8"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  }
}
"""

FILES["packages/validation/tsconfig.json"] = """{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
"""

FILES["packages/validation/src/index.ts"] = """// Shared request-validation schemas used by both the frontend forms
// (client-side UX validation only - never treated as proof of anything)
// and the backend API (authoritative validation before any contract
// interaction is prepared).

import { z } from 'zod';

/** A positive integer amount expressed as a decimal string (u256-safe: no floats). */
const weiAmount = z
  .string()
  .regex(/^[1-9][0-9]*$/, 'Amount must be a positive integer string (no decimals)');

export const createDisputeSchema = z.object({
  question: z
    .string()
    .min(10, 'Question must be at least 10 characters')
    .max(300, 'Question must be at most 300 characters'),
  description: z.string().max(5000).optional().default(''),
  category: z.enum([
    'CLIMATE',
    'GOVERNANCE',
    'TECH',
    'MEDIA',
    'FINANCE',
    'PUBLIC_HEALTH',
    'OTHER',
  ]),
  positionLabels: z
    .array(z.string().min(1).max(120))
    .min(2, 'A dispute needs at least two competing positions')
    .max(6, 'A dispute may have at most six competing positions'),
  participationDeadline: z.string().datetime(),
  evidenceDeadline: z.string().datetime(),
  minPositionStakeWei: weiAmount,
  minEvidenceStakeWei: weiAmount,
});

export type CreateDisputeInput = z.infer<typeof createDisputeSchema>;

export const submitEvidenceSchema = z.object({
  disputeId: z.string().uuid(),
  positionId: z.string().uuid(),
  sourceUrl: z.string().url('Source URL must be a valid, well-formed URL'),
  sourceTitle: z.string().min(3).max(300),
  publisher: z.string().min(1).max(200),
  publicationDate: z.string().datetime().optional(),
  summary: z
    .string()
    .min(20, 'Summary must be at least 20 characters')
    .max(2000, 'Summary must be at most 2000 characters'),
  stakeWei: weiAmount,
});

export type SubmitEvidenceInput = z.infer<typeof submitEvidenceSchema>;

export const stakePositionSchema = z.object({
  disputeId: z.string().uuid(),
  positionId: z.string().uuid(),
  stakeWei: weiAmount,
});

export type StakePositionInput = z.infer<typeof stakePositionSchema>;
"""

# ---------------------------------------------------------------------------
# apps/api (NestJS)
# ---------------------------------------------------------------------------

FILES["apps/api/package.json"] = """{
  "name": "@veritine/api",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "nest build",
    "start": "node dist/main.js",
    "dev": "nest start --watch",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@nestjs/common": "^10.4.6",
    "@nestjs/core": "^10.4.6",
    "@nestjs/platform-express": "^10.4.6",
    "@veritine/shared-config": "workspace:*",
    "@veritine/shared-types": "workspace:*",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.4.5",
    "@types/express": "^4.17.21",
    "@types/node": "^22.7.5",
    "typescript": "^5.6.3"
  }
}
"""

FILES["apps/api/tsconfig.json"] = """{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "outDir": "dist",
    "baseUrl": "./",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false
  },
  "include": ["src"]
}
"""

FILES["apps/api/nest-cli.json"] = """{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src"
}
"""

FILES["apps/api/src/main.ts"] = """import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { loadBackendEnv } from '@veritine/shared-config';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  // Fail fast on missing/invalid configuration before the app boots.
  const env = loadBackendEnv();

  const app = await NestFactory.create(AppModule);
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
"""

FILES["apps/api/src/app.module.ts"] = """import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [HealthModule],
})
export class AppModule {}
"""

FILES["apps/api/src/modules/health/health.module.ts"] = """import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
"""

FILES["apps/api/src/modules/health/health.controller.ts"] = """import { Controller, Get } from '@nestjs/common';

interface HealthResponse {
  status: 'ok';
  service: 'veritine-api';
  timestamp: string;
}

@Controller('health')
export class HealthController {
  @Get()
  check(): HealthResponse {
    return {
      status: 'ok',
      service: 'veritine-api',
      timestamp: new Date().toISOString(),
    };
  }
}
"""

# ---------------------------------------------------------------------------
# apps/web (Next.js App Router)
# ---------------------------------------------------------------------------

FILES["apps/web/package.json"] = """{
  "name": "@veritine/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@veritine/shared-config": "workspace:*",
    "@veritine/shared-types": "workspace:*",
    "next": "^14.2.15",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/node": "^22.7.5",
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.6.3"
  }
}
"""

FILES["apps/web/tsconfig.json"] = """{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
"""

FILES["apps/web/next.config.js"] = """/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@veritine/shared-types', '@veritine/shared-config'],
};

module.exports = nextConfig;
"""

FILES["apps/web/app/globals.css"] = """/* Veritine design tokens - "Obsidian Registry" system.
   Derived from the design prototype at
   ~/Documents/design/stitch_compact_dark_mode_ui/DESIGN.md (reference
   only, not copied verbatim - values re-declared here as the canonical
   Veritine tokens). */

:root {
  --surface: #16181d;
  --surface-dim: #121315;
  --surface-bright: #38393b;
  --surface-container-lowest: #0d0e10;
  --surface-container-low: #1b1c1e;
  --surface-container: #1f2022;
  --surface-container-high: #292a2c;
  --surface-container-highest: #343537;

  --on-surface: #e3e2e5;
  --on-surface-variant: #c3c6d7;
  --outline: #8d90a0;
  --outline-variant: #434655;
  --border-subtle: rgba(148, 163, 184, 0.12);

  --primary: #b4c5ff;
  --on-primary: #002a78;
  --primary-container: #2563eb;
  --on-primary-container: #eeefff;

  --secondary: #adc6ff;
  --tertiary: #ffb596;

  --verified: #10b981;
  --slashed: #ef4444;
  --pending: #f59e0b;

  --background: #0b0c0e;
  --text-primary: #f8fafc;
  --text-muted: #94a3b8;

  --radius-sm: 0.125rem;
  --radius-md: 0.25rem;
  --radius-lg: 0.5rem;
  --radius-full: 9999px;
}

* {
  box-sizing: border-box;
}

html,
body {
  padding: 0;
  margin: 0;
  background-color: var(--background);
  color: var(--on-surface);
  font-family:
    Inter,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    sans-serif;
  -webkit-font-smoothing: antialiased;
}
"""

FILES["apps/web/app/layout.tsx"] = """import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Veritine | A Staked Knowledge War',
  description:
    'Veritine turns controversial factual questions into structured, evidence-backed, ' +
    'economically accountable disputes, adjudicated by GenLayer Intelligent Contracts.',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
"""

FILES["apps/web/app/page.tsx"] = """export default function HomePage(): React.ReactElement {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        textAlign: 'center',
        padding: '2rem',
      }}
    >
      <h1 style={{ fontSize: '2.5rem', margin: 0 }}>Veritine</h1>
      <p style={{ color: 'var(--text-muted)', maxWidth: '32rem' }}>
        A Staked Knowledge War. Foundation stage - the full landing page ships in Phase 10.
      </p>
    </main>
  );
}
"""

FILES["apps/web/public/favicon.svg"] = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <rect width="32" height="32" rx="6" fill="#0B0C0E"/>
  <path d="M8 9 L16 24 L24 9" stroke="#B4C5FF" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="16" cy="9" r="2" fill="#10B981"/>
</svg>
"""

FILES["apps/web/public/logo.svg"] = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 32" width="160" height="32">
  <rect width="32" height="32" rx="6" fill="#0B0C0E"/>
  <path d="M8 9 L16 24 L24 9" stroke="#B4C5FF" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="16" cy="9" r="2" fill="#10B981"/>
  <text x="40" y="22" font-family="Geist, Inter, sans-serif" font-size="18" font-weight="700" fill="#E3E2E5">Veritine</text>
</svg>
"""


def main():
    for d in DIRS:
        os.makedirs(os.path.join(ROOT, d), exist_ok=True)

    written = []
    for rel_path, content in FILES.items():
        full_path = os.path.join(ROOT, rel_path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(content)
        written.append(rel_path)

    print(f"Wrote {len(written)} files:")
    for p in written:
        print(f"  + {p}")


if __name__ == "__main__":
    try:
        main()
    except OSError as e:
        print(f"ERROR: file operation failed: {e}", file=sys.stderr)
        sys.exit(1)
