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

Phases 0–12 of the build process complete (through security hardening and
testing/production validation). Deployment (Phase 13) is next. See
`docs/decisions/` for the running log of architectural decisions.

**Deployed contract**: `0xB1Cd4426003d7B443866294B6df55F085fdf3443` on
GenLayer StudioNet (chain id `61999`).

## Repository structure

- `apps/web` — Next.js (App Router) frontend, deployed to Vercel.
- `apps/api` — NestJS backend API, deployed to Fly.io (always-on).
- `contracts/` — the Veritine GenLayer Intelligent Contract, tests, deployment docs.
- `packages/` — shared TypeScript packages (types, contract client, validation, config).
- `database/` — Prisma schema, migrations, seeds.
- `docs/` — architecture, product, API, database, contract, security, deployment, operations, decisions.
- `infrastructure/` — Vercel / Fly / monitoring configuration.
- `scripts/setup/` — reproducible, rerunnable Python scripts that created each build stage.

## Stack

- Frontend: Next.js (App Router) + Tailwind CSS (Obsidian Registry design system), Vercel.
- Backend: NestJS, Fly.io, PostgreSQL (Fly Postgres managed).
- Auth: wallet-based (nonce-challenge signature verification via `ethers`), no custodial keys.
- Wallet connect: Reown AppKit + wagmi (MetaMask/Rainbow/Zerion/WalletConnect-compatible).
- Contract: GenLayer Intelligent Contract on GenLayer Studio / StudioNet.
- Contract client: `genlayer-js`, wrapped in `@veritine/contract-client`.
- Package manager: pnpm workspaces.

## Local setup

### Prerequisites

- Node.js ≥ 20, pnpm ≥ 9
- PostgreSQL (Homebrew: `brew install postgresql@16 && brew services start postgresql@16`)
- Python 3.11+ with a venv for contract tooling (see `contracts/.venv`)

### 1. Install dependencies

```bash
pnpm install
```

### 2. Database

```bash
psql postgres -c "CREATE ROLE veritine WITH LOGIN PASSWORD 'veritine' CREATEDB;"
psql postgres -c "CREATE DATABASE veritine_dev OWNER veritine;"
cp .env.example apps/api/.env   # fill in real values
pnpm --filter @veritine/api db:generate
pnpm --filter @veritine/api db:migrate:deploy
pnpm --filter @veritine/api db:seed
```

### 3. Environment variables

Copy `.env.example` to `apps/api/.env` and `apps/web/.env.local`, filling in
real secrets. **Use `127.0.0.1`, not `localhost`,** for `NEXT_PUBLIC_API_URL`
in local dev — see the note in `.env.example` for why.

### 4. Run the apps

```bash
pnpm --filter @veritine/api dev    # http://localhost:4000
pnpm --filter @veritine/web dev    # http://localhost:3000
```

### 5. Contract tooling (optional, only needed to modify the contract)

```bash
python3 -m venv contracts/.venv
source contracts/.venv/bin/activate
pip install genvm-linter genlayer-test
genvm-lint check contracts/veritine_contract.py --json
pytest contracts/tests/direct/ -v
```

## Testing

```bash
pnpm lint          # ESLint across all TS/TSX
pnpm typecheck     # tsc --noEmit across all workspaces
pnpm test          # Jest (backend) + Vitest (frontend) unit tests
pnpm build         # production builds of every app/package

# Contract (from repo root, with contracts/.venv activated):
genvm-lint check contracts/veritine_contract.py --json
pytest contracts/tests/direct/ -v
```

## Deployment

See `docs/deployment/` for the full Fly.io (backend) and Vercel (frontend)
deployment process, and `contracts/documentation/CONTRACT.md` for the
GenLayer StudioNet deployment process used for the contract itself.

## Security

See [SECURITY.md](SECURITY.md) for the full security model, the Phase 11
hardening review findings, dependency audit disposition, prompt-injection
defenses, and known risks.
