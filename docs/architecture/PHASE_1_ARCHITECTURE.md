# Veritine — Phase 1: Product & Architecture

Status: DRAFT — pending approval of economic model (slashing/reward percentages) before Phase 2 scaffolding begins.

## 1. Product specification

Veritine turns a controversial, verifiable factual question into a structured dispute. Users propose competing **positions** and back them with **evidence** (source URL + metadata + summary). Both positions and individual evidence items can carry a GEN stake. At the evidence deadline, the Veritine Intelligent Contract:

1. Fetches every cited source itself (contract-side web fetch — never trusts the submitter's description).
2. Cross-checks each source against other authoritative material it discovers.
3. Produces a structured, per-evidence verdict (not just a final yes/no) plus an overall dispute conclusion, which may be `INCONCLUSIVE`.
4. Applies proportional economic outcomes: rewards for strong evidence, refunds for good-faith-but-insufficient evidence, slashing scaled to how bad the evidence actually was (fabricated/misleading/manipulated — never "backed the losing side").

## 2. User roles
- **Visitor** — browses disputes/evidence/results, read-only, no auth.
- **Participant** (wallet-connected) — creates disputes, stakes on positions, submits & stakes evidence, claims rewards/refunds/withdrawals.
- **Admin** (small, contract-owner-gated) — pause new dispute creation in emergencies, adjust protocol-fee treasury address. Deliberately minimal — the contract does not have an admin override on adjudication outcomes.

## 3. Core user journeys
- **Public**: land → explorer → dispute detail → (optional) connect wallet to participate.
- **Dispute creator**: connect wallet → create dispute (question, category, positions, timeline, min stakes) → sign & submit creation tx (locks minimum creator stake) → monitor tx → dispute goes ACTIVE.
- **Position staker**: dispute detail → pick a position → enter stake → review risk disclosure → sign & submit → position stake recorded on-chain.
- **Evidence submitter**: dispute detail → "Submit Evidence" → URL + title + publisher + date + summary + supporting position → stake → sign & submit → evidence recorded PENDING.
- **Adjudication**: at evidence-deadline, anyone (or a scheduled trigger) calls `request_adjudication`; GenVM leader fetches sources, produces verdicts, validators reach consensus; result + verdicts stored on-chain, dispute → ADJUDICATED.
- **Reward/withdrawal**: dispute detail or dashboard → "Claim" → contract computes payout from position/evidence outcome → GEN transferred directly to caller's wallet (see value-transfer path, §7).

## 4. On-chain vs off-chain responsibility matrix

| Data | On-chain (contract) | Backend DB | Client state |
|---|---|---|---|
| Dispute question/positions/timeline | ✅ authoritative | indexed copy for search/filter | cached for render |
| Position stake amounts, evidence stake amounts | ✅ authoritative | indexed copy | cached |
| Evidence metadata (URL, title, publisher, summary) | ✅ authoritative (hash/content pinned) | indexed + full-text search | form draft |
| Adjudication verdicts & final conclusion | ✅ authoritative | indexed copy for UI | cached |
| Reward/slash/refund ledger, claimable balances | ✅ authoritative | indexed mirror for dashboard | — |
| User profile, notification prefs, linked socials | ❌ | ✅ authoritative | — |
| Session/auth nonces | ❌ | ✅ authoritative | nonce in-flight |
| Search indexes, activity feed, cached snapshots of fetched sources | ❌ | ✅ authoritative (cache only) | — |

Backend never becomes the source of truth for anything money-related — it reconciles against contract reads/events on an indexing loop and flags drift.

## 5. Authentication architecture (wallet-based, as selected)
- Frontend uses a wallet-connect library compatible with GenLayer's EVM-compatible chain layer (MetaMask/Rainbow/Zerion/WalletConnect-compatible).
- Login flow: client requests a nonce from `POST /api/v1/auth/nonce` (backend generates + stores a one-time nonce per address, TTL-bound) → wallet signs `SIWE`-style message containing nonce + domain + timestamp → `POST /api/v1/auth/verify` recovers signer address from signature, checks nonce validity+expiry, invalidates nonce, issues a short-lived session (httpOnly, secure, SameSite=strict cookie holding a signed session token).
- Reconnection: session cookie re-validated on load; if expired, silently re-prompt nonce-sign.
- Account switching: detect `accountsChanged` from provider, force re-auth for new address.
- Network mismatch: detect chain ID mismatch against configured GenLayer chain, block write actions with a clear banner until switched.
- Replay protection: nonce is single-use and expires (5 min); signed message binds domain + nonce + issued-at.

## 6. Database design (PostgreSQL / Fly Postgres) — entities
`users`, `wallets` (address, verified_at — no private key custody needed under wallet-based auth), `auth_nonces`, `sessions`, `social_connections` (OAuth-linked, provider, provider_user_id — never free-text username, per your anti-impersonation requirement), `disputes` (indexed mirror + off-chain fields: description richtext, category, search vector), `dispute_positions`, `evidence`, `evidence_metadata`, `evidence_source_snapshots` (cached fetched content + content hash + retrieved_at, for transparency/audit — not authoritative), `stakes` (position_stakes, evidence_stakes as typed sub-tables or a discriminated `stake_type`), `contract_transactions` (tx hash, method, status: pending/confirmed/failed/rejected, payload, synced_at), `adjudication_results`, `evidence_verdicts`, `reward_distributions`, `slashing_records`, `withdrawals`, `notifications`, `audit_logs`, `application_settings`.

All indexed/mirrored tables carry `contract_synced_at` and a reconciliation job compares them against contract reads on a schedule; drift raises an audit_log entry, never silently overwritten in the "wrong direction."

## 7. GenLayer contract architecture — value-transfer path (escrow)

Modeled directly on the reviewed ShipBond pattern you supplied (see project memory `genlayer-contract-requirements`):

- Every GEN-accepting method is `@gl.public.write.payable`; amount is read only from `gl.message.value` (u256), never a parameter.
- Every stake type keeps two fields: the **term** (`position_stake_required_wei`) and the **ledger** (`position_stake_deposited_wei`) — payout logic only reads the ledger.
- Single emission choke point: `_send_gen(to_address, amount)` wraps a `@gl.evm.contract_interface` recipient stub's `emit_transfer` — the only way GEN ever leaves the contract.
- Every payout path (reward, refund, slash-redistribution, timeout recovery, cancellation refund): **read ledger → zero ledger → save state → then `_send_gen`**, with a `reward <= 0` guard at entry so a repeat call can't double-pay.
- Exit paths enumerated up front: adjudicated win (reward + stake back), adjudicated partial (proportional split), adjudicated loss / slash (partial or full slash, remainder to treasury/winning pool), evidence-deadline-missed-by-contract timeout recovery (participant can reclaim after grace period if adjudication never runs), dispute cancellation before any counter-stake (full refund).

## 8. Adjudication design
Reproducible, explicit 18-step process per the readme (read question → read positions → read evidence → fetch each cited source → validate source content actually supports submitter's claim → assess authority/relevance/timeliness → research independent authoritative sources where needed → compare across positions → identify contradictions/gaps → produce structured per-evidence verdict (authenticity/authority/relevance/timeliness/claim-support/materiality/misrepresentation) → produce final dispute conclusion (may be `INCONCLUSIVE` or `QUESTION_INVALID`) → map verdicts to economic outcomes → persist to contract state). Source content is always treated as **untrusted data** — a structured evaluation prompt explicitly instructs the LLM to ignore any instructions embedded in fetched page content; output is JSON-schema-validated against an allow-listed verdict enum, never free text trusted directly for economic decisions (this is also what keeps this from failing review-team rule #4 — validators re-derive the substantive verdict, not just check JSON shape).

## 9. Threat model highlights
Reentrancy-shaped double-spend (defended by the zero-then-transfer ordering, §7), prompt injection from fetched web content (defended by untrusted-content framing + structured/validated output, §8), spam disputes/evidence (defended by minimum stakes), sybil position-splitting to game payout-proportion math (defended by per-address stake caps under review), stale/edited source content after submission (defended by content-hash snapshot at fetch time), stake dusting/DoS via excessive evidence volume (defended by per-dispute evidence count cap + rising marginal stake requirement), front-running of adjudication triggers (defended by adjudication being deteradministically triggerable by anyone only after the deadline, with no advantage to the trigger caller).

## 10. Economic model — APPROVED 2026-08-02

| Evidence outcome | Stake outcome |
|---|---|
| Strongly supported | 100% stake returned + proportional share of reward pool |
| Credible and relevant | 100% stake returned + proportional share of reward pool |
| Credible but limited | 100% refund, no reward |
| Inconclusive | 100% refund |
| Outdated but not deceptive | 100% refund |
| Weak or materially incomplete | 25% slash |
| Materially irrelevant | 50% slash |
| Misleading | 75% slash |
| Fabricated or unverifiable | 100% slash |
| Maliciously manipulated | 100% slash + address flagged in contract state (`flagged_addresses`) for future dispute-eligibility review |

Slashed-stake pool split: **90% to winning-side stakers** (proportional to their stake), **10% to protocol treasury**.
Protocol fee: **2%** taken off the top of reward payouts (not off refunds/returned stakes), routed to treasury.
Treasury address is a contract-owner-configurable field, settable once at deploy time and changeable only via an owner-gated method — funds ongoing adjudication (LLM/web-fetch) costs and development.
