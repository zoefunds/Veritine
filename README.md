# Veritine

**A Staked Knowledge War.**

Veritine turns controversial, verifiable factual questions into structured,
evidence-backed, economically accountable disputes. Participants stake GEN
behind positions *and* behind individual pieces of evidence; a GenLayer
Intelligent Contract independently fetches and cross-checks cited sources,
adjudicates evidence quality, and applies proportional rewards, refunds, or
slashing — never punishing evidence merely for backing the losing side.

Full product/architecture spec: see [docs/architecture/PHASE_1_ARCHITECTURE.md](docs/architecture/PHASE_1_ARCHITECTURE.md).

## Status

Early scaffolding stage. See `docs/decisions/` for the running log of
architectural decisions and `docs/architecture/` for the current design.

## Repository structure

- `apps/web` — Next.js (App Router) frontend, deployed to Vercel.
- `apps/api` — NestJS backend API, deployed to Fly.io (always-on).
- `contracts/` — the Veritine GenLayer Intelligent Contract, tests, deployment docs.
- `packages/` — shared TypeScript packages (types, contract client, validation, config).
- `database/` — migrations, seeds, schema docs for the PostgreSQL (Fly Postgres) database.
- `docs/` — architecture, product, API, database, contract, security, deployment, operations, decisions.
- `infrastructure/` — Vercel / Fly / monitoring configuration.
- `scripts/` — setup, development, testing, deployment, maintenance scripts.

## Stack

- Frontend: Next.js (App Router), Vercel.
- Backend: NestJS, Fly.io, PostgreSQL (Fly Postgres managed).
- Auth: wallet-based (nonce-challenge signature verification), no custodial keys.
- Contract: GenLayer Intelligent Contract on GenLayer Studio / StudioNet.
- Package manager: pnpm workspaces.

## Local setup

Setup instructions land here as each phase completes (foundation, database,
auth, contract, integration — see `docs/architecture/`).

## Security

See `SECURITY.md` (added in a later phase) for the full security model,
prompt-injection defenses, and wallet risk disclosures.
