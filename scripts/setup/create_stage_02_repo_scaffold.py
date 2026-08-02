#!/usr/bin/env python3
"""
Veritine — Stage 02: Repository scaffold.

Creates the pnpm-workspace monorepo skeleton, root config files, and
directory structure for Veritine (formerly SourceStake). Does NOT write
application code yet (that's later phases) — this stage creates the
skeleton and config only, per the project's phased build process.

Run from: /Users/macbook/source-stake  (the project root)
Command:  python3 scripts/setup/create_stage_02_repo_scaffold.py

Safe to rerun: yes. Files listed in EXISTING_OK are left untouched if
already present; everything else is written fresh (this stage assumes
an otherwise-empty repo).
"""

import os
import sys

ROOT = os.getcwd()

DIRS = [
    "apps/web/app",
    "apps/web/components",
    "apps/web/features",
    "apps/web/hooks",
    "apps/web/lib",
    "apps/web/services",
    "apps/web/types",
    "apps/web/styles",
    "apps/web/public",
    "apps/web/tests",
    "apps/api/src/modules",
    "apps/api/src/routes",
    "apps/api/src/controllers",
    "apps/api/src/services",
    "apps/api/src/repositories",
    "apps/api/src/middleware",
    "apps/api/src/validators",
    "apps/api/src/integrations",
    "apps/api/src/jobs",
    "apps/api/src/events",
    "apps/api/src/config",
    "apps/api/src/shared",
    "apps/api/tests",
    "contracts/tests/direct",
    "contracts/tests/integration",
    "contracts/deployment",
    "contracts/documentation",
    "packages/shared-types/src",
    "packages/contract-client/src",
    "packages/validation/src",
    "packages/shared-config/src",
    "database/migrations",
    "database/seeds",
    "database/schemas",
    "database/documentation",
    "scripts/setup",
    "scripts/development",
    "scripts/testing",
    "scripts/deployment",
    "scripts/maintenance",
    "docs/architecture",
    "docs/product",
    "docs/api",
    "docs/database",
    "docs/contracts",
    "docs/security",
    "docs/deployment",
    "docs/operations",
    "docs/decisions",
    "infrastructure/vercel",
    "infrastructure/backend-hosting",
    "infrastructure/monitoring",
    ".github/workflows",
]

# path -> content. Only written if the file does not already exist,
# UNLESS the path is listed in FORCE_OVERWRITE (root config we always
# want current).
FORCE_OVERWRITE = {
    "pnpm-workspace.yaml",
    ".gitignore",
    ".env.example",
    "package.json",
}

FILES = {}

FILES["pnpm-workspace.yaml"] = """packages:
  - "apps/*"
  - "packages/*"
"""

FILES["package.json"] = """{
  "name": "veritine",
  "private": true,
  "version": "0.1.0",
  "description": "Veritine \u2014 A Staked Knowledge War. Evidence-staking platform adjudicated by GenLayer Intelligent Contracts.",
  "packageManager": "pnpm@9.15.0",
  "engines": {
    "node": ">=20.0.0"
  },
  "scripts": {
    "dev:web": "pnpm --filter @veritine/web dev",
    "dev:api": "pnpm --filter @veritine/api dev",
    "build": "pnpm -r build",
    "lint": "pnpm -r lint",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck"
  }
}
"""

FILES[".gitignore"] = """# Dependencies
node_modules/
.pnpm-store/

# Env
.env
.env.local
.env.*.local
!.env.example

# Build output
apps/web/.next/
apps/web/out/
apps/api/dist/
packages/*/dist/

# Python
__pycache__/
*.pyc
.venv/
.venv*/
*.egg-info/

# GenLayer
.genlayer/
contracts/**/__pycache__/

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
pnpm-debug.log*

# IDE
.vscode/
.idea/

# Test / coverage
coverage/
.nyc_output/

# Fly
fly.toml.bak
"""

FILES[".env.example"] = """# ---------------------------------------------------------------------------
# Veritine environment configuration
# Copy to .env (root, gitignored) and to apps/web/.env.local / apps/api/.env
# as appropriate. Never commit real values.
# ---------------------------------------------------------------------------

# General
NODE_ENV=development
APP_URL=http://localhost:3000
API_URL=http://localhost:4000
BACKEND_URL=http://localhost:4000
FRONTEND_URL=http://localhost:3000

# Database (Fly Postgres in production; local Postgres in dev)
DATABASE_URL=postgresql://veritine:veritine@localhost:5432/veritine_dev

# Auth (wallet-based, nonce-challenge)
SESSION_SECRET=replace_with_a_long_random_string
NONCE_TTL_SECONDS=300

# GenLayer
GENLAYER_NETWORK=studionet
GENLAYER_RPC_URL=https://studio.genlayer.com/api
GENLAYER_CONTRACT_ADDRESS=
GENLAYER_CHAIN_ID=

# Backend-only secrets \u2014 never expose these with a NEXT_PUBLIC_ prefix
JWT_SECRET=replace_with_a_long_random_string

# Gates POST /indexer/sync (fans out into real GenLayer RPC calls against
# a 5,000/day quota) \u2014 strongly recommended in production, optional in dev.
# Generate with: openssl rand -hex 32
INTERNAL_API_KEY=

# Frontend-public (safe to expose \u2014 must be prefixed for Next.js)
# NOTE: use 127.0.0.1, not localhost, for local dev - Node's fetch can
# resolve "localhost" to ::1 (IPv6) while the API only binds 0.0.0.0
# (IPv4), causing ECONNREFUSED from Next.js server components.
NEXT_PUBLIC_API_URL=http://127.0.0.1:4000
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_GENLAYER_NETWORK=studionet
NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS=
NEXT_PUBLIC_GENLAYER_CHAIN_ID=

# Reown (WalletConnect) project id \\u2014 public client id, safe to expose.
# Get one at https://cloud.reown.com if this needs to change.
NEXT_PUBLIC_REOWN_PROJECT_ID=523edbf281538b53acb1ee5b83930653
"""

FILES["README.md"] = """# Veritine

**A Staked Knowledge War.**

Veritine turns controversial, verifiable factual questions into structured,
evidence-backed, economically accountable disputes. Participants stake GEN
behind positions *and* behind individual pieces of evidence; a GenLayer
Intelligent Contract independently fetches and cross-checks cited sources,
adjudicates evidence quality, and applies proportional rewards, refunds, or
slashing \u2014 never punishing evidence merely for backing the losing side.

Full product/architecture spec: see [docs/architecture/PHASE_1_ARCHITECTURE.md](docs/architecture/PHASE_1_ARCHITECTURE.md).

## Status

Early scaffolding stage. See `docs/decisions/` for the running log of
architectural decisions and `docs/architecture/` for the current design.

## Repository structure

- `apps/web` \u2014 Next.js (App Router) frontend, deployed to Vercel.
- `apps/api` \u2014 NestJS backend API, deployed to Fly.io (always-on).
- `contracts/` \u2014 the Veritine GenLayer Intelligent Contract, tests, deployment docs.
- `packages/` \u2014 shared TypeScript packages (types, contract client, validation, config).
- `database/` \u2014 migrations, seeds, schema docs for the PostgreSQL (Fly Postgres) database.
- `docs/` \u2014 architecture, product, API, database, contract, security, deployment, operations, decisions.
- `infrastructure/` \u2014 Vercel / Fly / monitoring configuration.
- `scripts/` \u2014 setup, development, testing, deployment, maintenance scripts.

## Stack

- Frontend: Next.js (App Router), Vercel.
- Backend: NestJS, Fly.io, PostgreSQL (Fly Postgres managed).
- Auth: wallet-based (nonce-challenge signature verification), no custodial keys.
- Contract: GenLayer Intelligent Contract on GenLayer Studio / StudioNet.
- Package manager: pnpm workspaces.

## Local setup

Setup instructions land here as each phase completes (foundation, database,
auth, contract, integration \u2014 see `docs/architecture/`).

## Security

See `SECURITY.md` (added in a later phase) for the full security model,
prompt-injection defenses, and wallet risk disclosures.
"""

FILES["SECURITY.md"] = """# Security

This document is populated during Phase 11 (Security and Hardening) of the
Veritine build process. Placeholder created at repository scaffolding time
so the file exists from the first commit.

Planned sections: security model, responsible disclosure, known risks,
wallet risks, web-source risks, LLM / prompt-injection risks and defenses,
contract risks, user responsibilities.
"""

FILES["CONTRIBUTING.md"] = """# Contributing to Veritine

This is currently a single-maintainer project in active early development.
Contribution guidelines will be expanded once the core product ships.

## Development principles

- No placeholder or mocked implementations in code presented as complete.
- The GenLayer Intelligent Contract is the source of truth for all
  contract-owned state (stakes, adjudication results, rewards, slashing).
  The backend indexes and reconciles \u2014 it never overrides.
- Follow the escrow/value-transfer ordering discipline documented in
  `docs/contracts/` for any code that moves GEN.
"""

FILES["LICENSE"] = """Copyright (c) 2026 Veritine

All rights reserved. License terms to be finalized before public release.
"""

FILES["docs/decisions/0001-project-renamed-to-veritine.md"] = """# 0001 \u2014 Project renamed from SourceStake to Veritine

Date: 2026-08-02

## Status

Approved.

## Context

The working name "SourceStake" read as a generic crypto-staking product
name and did not distinguish the project from generic DeFi staking
dashboards.

## Decision

Renamed the platform to **Veritine** (from *veritas*, truth). Applied
across the repository, contract, frontend copy, documentation, favicon/logo,
and environment variable prefixes.

## Consequences

Any historical references to "SourceStake" in design assets
(`~/Documents/design/stitch_compact_dark_mode_ui/*.html`) are used only as
visual/layout prototypes \u2014 all product-facing copy in the built
application uses "Veritine."
"""

FILES["docs/decisions/0002-economic-model-approved.md"] = """# 0002 \u2014 Economic model approved

Date: 2026-08-02

## Status

Approved.

## Decision

See `docs/architecture/PHASE_1_ARCHITECTURE.md` \u00a710 for the full
evidence-outcome \u2192 stake-outcome table. Summary:

- Slash tiers range from 0% (strongly supported / credible+relevant /
  credible-but-limited / inconclusive / outdated-not-deceptive) up to 100%
  (fabricated/unverifiable, maliciously manipulated).
- Slashed pool: 90% to winning-side stakers (proportional), 10% to
  protocol treasury.
- Protocol fee: 2% on reward payouts only (never on refunds or returned
  principal), routed to treasury.
"""

FILES["contracts/documentation/.gitkeep"] = ""
FILES["database/documentation/.gitkeep"] = ""
FILES["docs/product/.gitkeep"] = ""
FILES["docs/api/.gitkeep"] = ""
FILES["docs/security/.gitkeep"] = ""
FILES["docs/deployment/.gitkeep"] = ""
FILES["docs/operations/.gitkeep"] = ""
FILES["infrastructure/vercel/.gitkeep"] = ""
FILES["infrastructure/backend-hosting/.gitkeep"] = ""
FILES["infrastructure/monitoring/.gitkeep"] = ""


def main():
    created, skipped = [], []

    for d in DIRS:
        path = os.path.join(ROOT, d)
        os.makedirs(path, exist_ok=True)

    for rel_path, content in FILES.items():
        full_path = os.path.join(ROOT, rel_path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        exists = os.path.exists(full_path)
        if exists and rel_path not in FORCE_OVERWRITE:
            skipped.append(rel_path)
            continue
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(content)
        created.append(rel_path)

    print(f"Created/updated {len(created)} files:")
    for p in created:
        print(f"  + {p}")
    if skipped:
        print(f"\\nSkipped {len(skipped)} existing files (not in FORCE_OVERWRITE):")
        for p in skipped:
            print(f"  - {p}")
    print(f"\\nEnsured {len(DIRS)} directories exist under {ROOT}")


if __name__ == "__main__":
    try:
        main()
    except OSError as e:
        print(f"ERROR: file operation failed: {e}", file=sys.stderr)
        sys.exit(1)
