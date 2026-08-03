# Deployment

Veritine's backend runs on Fly.io (always-on) and its frontend on Vercel.
Both are connected to the `zoefunds/Veritine` GitHub repo's `main` branch.

## Backend — Fly.io

**App**: `veritine-api` · **URL**: https://veritine-api.fly.dev

The API is a NestJS app in a pnpm workspace monorepo. `apps/api/Dockerfile`
is a multi-stage build (base/deps/build/runtime) run from the repo root as
build context (see `fly.toml`'s `[build].dockerfile`).

### Config

- `fly.toml` (repo root): always-on (`min_machines_running = 1`,
  `auto_stop_machines = false`), health check on `GET /api/v1/health`.
- OpenSSL is installed explicitly in both Docker stages, and
  `database/schema.prisma`'s `generator client` pins
  `binaryTargets = ["native", "debian-openssl-3.0.x"]` — without both,
  Prisma silently picks the wrong query-engine binary for
  `node:20-slim` and the machine crashes at boot with
  `PrismaClientInitializationError`.

### Secrets

Set via `fly secrets set KEY=value --app veritine-api`:

- `DATABASE_URL` — Fly Postgres connection string.
- `GENLAYER_CONTRACT_ADDRESS`, `GENLAYER_NETWORK`, `GENLAYER_CHAIN_ID`,
  `GENLAYER_RPC_URL` — must match the frontend's `NEXT_PUBLIC_GENLAYER_*`
  equivalents exactly, or reads/writes will silently target different
  chains/contracts.
- `FRONTEND_URL` — the live Vercel URL, used for CORS (`apps/api/src/main.ts`).
- `INTERNAL_API_KEY` — gates `POST /indexer/sync` (the full fan-out
  resync); `POST /indexer/sync/:contractDisputeId` (single-dispute sync)
  is intentionally *not* gated by this — see
  `apps/api/src/modules/indexer/indexer.controller.ts`.
- `JWT_SECRET`, `SESSION_SECRET` — auth.
- `RESOLVER_PRIVATE_KEY` — a dedicated operational hot wallet's private
  key (hex, `0x`-prefixed), used by `ResolverService` to automatically
  call the permissionless `request_adjudication` once a dispute's
  evidence deadline passes. See
  `docs/decisions/0004-automated-adjudication-resolver.md` for the full
  rationale and key-custody notes. Fund this wallet's address with a
  small amount of GEN for gas; if unset, the resolver no-ops and
  adjudication falls back to the manual "Request Adjudication" button.

### Deploying

```bash
fly deploy --app veritine-api
```

### Redeploying the contract (rotating the address)

When the GenLayer contract is redeployed to a new address, the old
address's indexed data (disputes, positions, evidence — all just a mirror,
see `apps/api/src/modules/indexer/indexer.service.ts`) is meaningless
against the new one and should be cleared, not left to linger:

```bash
# 1. Point the backend at the new contract
fly secrets set GENLAYER_CONTRACT_ADDRESS=0x... --app veritine-api

# 2. Wipe the mirror tables (cascades to positions/evidence/etc.)
fly ssh console --app veritine-api -C \
  "node_modules/.bin/prisma db execute --schema ../../database/schema.prisma --stdin" \
  <<< 'TRUNCATE TABLE "Dispute" CASCADE;'

# 3. Update the frontend's NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS (see below)
#    and redeploy it too - both sides must agree on the address.
```

The next scheduled sync (every 5 minutes, `IndexerService.scheduledSync`)
or any manual `POST /indexer/sync/:id` call will repopulate from the new
contract's actual on-chain state.

## Frontend — Vercel

**Project**: `veritine` (team `adebiyi2002gmailcoms-projects`) · **URL**: https://veritine.vercel.app

Next.js 14 App Router, monorepo-aware config in `apps/web/vercel.json`.
Project settings (dashboard → Settings → Build and Deployment) have
**Root Directory** set to `apps/web` with "Include files outside the
Root Directory" enabled, so the build can still resolve pnpm workspace
packages (`@veritine/contract-client`, `@veritine/shared-types`, etc.)
that live outside `apps/web`.

### Env vars (Project Settings → Environment Variables, Production)

- `NEXT_PUBLIC_API_URL` — `https://veritine-api.fly.dev`
- `NEXT_PUBLIC_GENLAYER_NETWORK`, `NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS`,
  `NEXT_PUBLIC_GENLAYER_CHAIN_ID` — must match the backend's `GENLAYER_*`
  secrets exactly.
- `NEXT_PUBLIC_REOWN_PROJECT_ID` — wallet connect.

`NEXT_PUBLIC_*` vars are baked in at build time, so changing one requires
a fresh deploy (`vercel env` changes alone don't affect already-built
deployments).

### Deploying

```bash
vercel deploy --prod --yes --scope adebiyi2002gmailcoms-projects
```

### Caching note

Dispute pages (`/disputes`, `/disputes/[id]`, `/dashboard`) use
`export const revalidate = 5` rather than `force-dynamic` — a short
time-based cache keeps navigation fast without the platform-wide fully
uncached round trip that made pages feel slow. `apiFetch()`
(`apps/web/lib/api-client.ts`) sets `next: { revalidate: 5 }` on every
backend read to match; a caller needing a guaranteed-fresh read can still
pass `cache: 'no-store'` explicitly.

## After any deploy

Verify both ends agree and are reachable:

```bash
curl -s https://veritine-api.fly.dev/api/v1/health
curl -s https://veritine-api.fly.dev/api/v1/disputes
curl -s -o /dev/null -w "%{http_code}\n" https://veritine.vercel.app
```

## Contract deployment

See `contracts/documentation/CONTRACT.md` for the GenLayer Studio
deployment process for the Intelligent Contract itself — deployed
manually via GenLayer Studio, not by this repo's CI/CD, and the address
is then wired into both sides as described above.
