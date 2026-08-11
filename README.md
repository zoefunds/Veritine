# Veritine

**A Staked Knowledge War.**

Veritine turns controversial, verifiable factual questions into structured,
evidence-backed, economically accountable disputes. Participants stake GEN
behind positions *and* behind individual pieces of evidence; a GenLayer
Intelligent Contract independently fetches and cross-checks cited sources,
adjudicates evidence quality, and applies proportional rewards, refunds, or
slashing — never punishing evidence merely for backing the losing side.

Full product/architecture spec: see [docs/architecture/PHASE_1_ARCHITECTURE.md](docs/architecture/PHASE_1_ARCHITECTURE.md).

## What Veritine is

Public discourse is full of contested factual claims — "did X actually
happen," "was Y actually released/confirmed/announced" — that get argued
endlessly with no mechanism to settle them, and no cost to being wrong or
dishonest about the evidence. Veritine is a market for resolving exactly
that kind of question: verifiable, controversial, and currently unsettled.

It is **not** a prediction market on future events, and it is **not** a poll.
A Veritine dispute asks about something that already has a factual answer —
it's just contested or unverified — and the platform's job is to force that
answer into the open through staked evidence and independent, automated
adjudication, rather than through moderator judgment or majority vote.

The core idea: **money should back claims, and claims should back sources.**
Anyone can assert a position for free. On Veritine, asserting a position
costs GEN, and every piece of evidence you cite to support it is itself a
separately staked, separately judged claim about the quality of that source.
That second layer is what makes Veritine different from a normal prediction
market — you aren't just betting on an outcome, you're bonding the honesty
of the sources you bring to argue for it.

### How a dispute works, end to end

1. **Creation** — Someone proposes a factual question (e.g. *"Did OpenAI
   publicly release GPT-5 in 2025?"*), a category, a set of mutually
   exclusive positions (e.g. "Yes" / "No"), minimum stake amounts, a
   participation deadline, and an evidence deadline. This becomes an
   `ACTIVE` dispute.
2. **Position staking** — Anyone can stake GEN behind whichever position
   they believe is factually correct. This is a simple, zero-sum bet on
   *which answer is right* — nothing about evidence quality yet.
3. **Evidence submission** — Anyone can submit evidence for a position: a
   source URL, title, publisher, source-type classification (primary
   source, official report, peer-reviewed research, social media, etc.),
   and a written summary of how the source supports the position — backed
   by its own GEN stake. Multiple people can submit multiple pieces of
   evidence on either side.
4. **Evidence window closes** — Once the evidence deadline passes, staking
   and evidence submission stop; the dispute is frozen for adjudication.
5. **Adjudication (automated, permissionless)** — Anyone can call
   `request_adjudication` on the contract once the deadline has passed (an
   automated resolver bot does this on a schedule so it doesn't depend on a
   human remembering — see "Automated adjudication" below). The contract
   itself, running on GenLayer's Intelligent Contract runtime:
   - **Fetches every cited source itself**, live, at adjudication time — it
     never trusts the submitter's description of what a source says.
   - Independently evaluates each piece of evidence in isolation across
     seven dimensions (authenticity, authority, relevance, timeliness,
     claim-support, materiality, misrepresentation) and assigns it one of
     ten structured outcome tiers, from `STRONGLY_SUPPORTED` down to
     `FABRICATED_OR_UNVERIFIABLE` / `MALICIOUSLY_MANIPULATED`.
   - Then reasons **only over the already-adjudicated evidence verdicts**
     (not the raw source text again) to reach an overall dispute
     conclusion and declare a winning position — or declare the dispute
     `INCONCLUSIVE` / `EVIDENCE_INSUFFICIENT` if the evidence doesn't
     settle it either way, in which case nobody "wins" and stakes are
     simply refunded.
   - Every verdict is independently re-derived by a second validator model
     (not just checked for matching JSON shape) before being accepted —
     see "Adjudication design" below for how disagreement is handled.
6. **Settlement & claims** — Once adjudicated, participants call `claim` to
   receive whatever the contract computes they're owed — reward, refund, or
   (for weak/dishonest evidence) a slashed remainder — directly to their
   wallet balance, withdrawable at any time.

### The two independent stakes, and why they're separate

A **position stake** and an **evidence stake** answer two different
questions, are judged on two different criteria, and settle independently:

- **Position stake — "I bet this side is factually correct."** Binary and
  zero-sum: the losing position's total stake is forfeited (minus a small
  protocol fee) and redistributed proportionally to the winning position's
  stakers, on top of their own principal back. There's no partial credit —
  you're simply right or wrong about which answer the adjudicated evidence
  supports.
- **Evidence stake — "I vouch this source is genuine, relevant, and
  actually supports what I claimed."** Graded, not binary: slashed
  0–100% purely as a function of that evidence item's own adjudicated
  quality, completely independent of whether the position it supported
  ultimately won. You can submit evidence for the losing side and still
  get most or all of your stake back if the source itself was credible and
  relevant — and conversely, evidence for the *winning* side still gets
  slashed if it turns out to be fabricated, materially irrelevant, or
  misleading. Slashing punishes bad evidence, never being on the "losing"
  side of the debate.

This separation is the whole point: it means someone can win their bet
without their sloppy or dishonest sourcing being rewarded for it, and
someone can lose their bet without their honest, credible sourcing being
punished for it.

### The full payout model

| Evidence outcome | Slash | Reward-eligible |
|---|---|---|
| Strongly supported | 0% | Yes |
| Credible and relevant | 0% | Yes |
| Credible but limited | 0% | No |
| Inconclusive | 0% | No |
| Outdated but not deceptive | 0% | No |
| Weak or materially incomplete | 25% | No |
| Materially irrelevant | 50% | No |
| Misleading | 75% | No |
| Fabricated or unverifiable | 100% | No |
| Maliciously manipulated | 100% | No — and the address is **flagged** |

- **Position payouts**: losing side forfeits its principal entirely to the
  winning side (pro-rata across winning stakers), minus a 2% protocol fee
  taken only from that redistribution — never from refunds or principal.
  If the dispute resolves to a no-winner conclusion (`INCONCLUSIVE`,
  `EVIDENCE_INSUFFICIENT`, `CLAIM_UNSUPPORTED`, `QUESTION_INVALID`), every
  position staker is fully refunded instead — nothing is redistributed. A
  larger stake is never itself treated as evidence of correctness — the
  adjudication prompts are explicitly instructed to ignore stake size.
- **Evidence payouts**: each evidence item's own stake is slashed by its
  own tier's percentage; the after-slash remainder returns proportionally
  to that item's stakers. Every slashed amount across the dispute is
  pooled and split 90% to a **reward pool** for stakers on
  reward-eligible evidence (`STRONGLY_SUPPORTED` / `CREDIBLE_AND_RELEVANT`)
  and 10% to the protocol treasury — so dishonest evidence directly funds
  a bonus for the people who brought honest, high-quality sourcing to the
  same dispute.
- **Full refunds, no fees, no slashing**: dispute cancellation before any
  counter-participation, owner emergency cancellation, and the
  adjudication-timeout recovery path (evidence deadline + 7 days passes
  with adjudication never triggered — first claim attempt after that
  window marks the dispute `INVALID` and unlocks full refunds for
  everyone, so funds can never get permanently stuck).

### Adjudication design

`request_adjudication` runs as two passes inside the contract, each using a
**leader/validator consensus model with a custom validator function**
(GenLayer's non-deterministic execution primitive) rather than blind trust
in a single model's output:

1. **Per-evidence pass** — for each piece of evidence, a leader fetches the
   live source and produces a structured verdict; an independent validator
   re-fetches and re-classifies the same source from scratch. The two are
   compared on reward-eligibility and flagging (must match exactly — these
   swing who gets paid or reputationally flagged) and on slash percentage
   (tolerated within one tier-step, to absorb ordinary phrasing variance
   without tolerating an actually decisive disagreement).
2. **Conclusion pass** — reasons only over the already-adjudicated evidence
   verdicts (bounding compute regardless of how much source text was
   involved) to decide the winning position; the validator's independently
   re-derived `winning_position_index` must match exactly.

Fetched source content is always treated as **untrusted external data** —
the evaluation prompts explicitly instruct the model to never follow
instructions embedded in a page's content, defending against prompt
injection from a source the model itself fetches live. Full detail:
[docs/contracts/ADJUDICATION.md](docs/contracts/ADJUDICATION.md).

## Status

Phases 0–13 of the build process complete: design, contract, backend,
frontend, security hardening, testing/production validation, and
deployment. See `docs/decisions/` for the running log of architectural
decisions.

**Live deployment:**

- Frontend: [veritine.vercel.app](https://veritine.vercel.app) (Vercel)
- Backend API: [veritine-api.fly.dev](https://veritine-api.fly.dev) (Fly.io, always-on)
- Contract: `0xe079aEaa565bca181FDfa0Cc275398701E23B0B5` on GenLayer
  StudioNet (chain id `61999`)

See `docs/deployment/DEPLOYMENT.md` for the full deployment process,
including how to rotate the contract address if it's redeployed.

## Pages

- `/` — landing page.
- `/disputes` — dispute explorer: status/category filters, free-text search.
- `/disputes/create` — create a new dispute.
- `/disputes/[id]` — dispute detail: positions, stake/evidence forms (open
  only while the dispute is `ACTIVE`), evidence registry, adjudication panel,
  request-adjudication button (permissionless, surfaces once the evidence
  deadline has passed).
- `/disputes/[id]/evidence/[evidenceId]` — single piece of evidence: source,
  verdict, submitter, and the connected wallet's own stake/claim status.
- `/profile/[address]` — any wallet's public activity: on-chain balance and
  flag count, plus its position stakes and evidence submissions.
- `/stats` — live platform stats, protocol config, and the evidence outcome
  slash/reward table, read directly from the contract.
- `/dashboard` — the connected wallet's own command center (balance,
  withdraw, "My Activity").
- `/docs` — product/protocol documentation.

## Automated adjudication (operational detail)

Adjudication itself is permissionless — anyone can call it, including
manually via the frontend's "Request Adjudication" button — but nothing
should depend on a human remembering to trigger it. `apps/api/src/modules/resolver/resolver.service.ts`
runs every 5 minutes and calls `request_adjudication` for any dispute past
its evidence deadline. On a successful call it marks the dispute
`ADJUDICATING` in Postgres immediately (rather than waiting on the indexer
resync), so a lagging sync can't cause the next tick to re-request
adjudication on the same dispute. Requires `RESOLVER_PRIVATE_KEY` (a
dedicated platform hot wallet, never a user's own key); if unset, automated
resolution is a no-op and the manual path still works.

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
