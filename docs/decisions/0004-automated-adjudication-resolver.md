# 0004 — Automated adjudication resolver

Date: 2026-08-03

## Status

Deployed.

## Context

`request_adjudication(dispute_id)` is a permissionless contract write —
anyone can call it once a dispute's evidence deadline has passed — but
until now nothing ever called it automatically. A "Request Adjudication"
button was added to the dispute detail page (see prior commit), but that
still requires a human to notice the deadline passed and click it.

## Decision

Added `ResolverService` (`apps/api/src/modules/resolver/resolver.service.ts`),
a cron job (`EVERY_5_MINUTES`, same cadence as the indexer) that:

1. Queries Postgres for disputes with `status IN (ACTIVE, EVIDENCE_CLOSED)`,
   `evidenceDeadline < now`, and no `adjudicationResult` yet.
2. Calls `request_adjudication` for each, using a dedicated platform-held
   hot wallet rather than any user's own key.
3. Syncs the dispute immediately afterward so the settled state is
   visible without waiting on the next indexer cron tick.

## Key custody

- `RESOLVER_PRIVATE_KEY` is a Fly.io secret, same tier as `JWT_SECRET`/
  `INTERNAL_API_KEY` — never in source, never logged.
- The wallet is a disposable/dedicated operational address, holding only
  enough GEN to cover `request_adjudication` gas. It has no special
  permissions on-chain — the contract call is permissionless by design,
  so this key is a convenience for automation, not a trust boundary. If
  it were ever compromised, the worst case is someone else calls
  `request_adjudication` slightly more often than intended, which is
  already something anyone can do anyway.
- `VeritineWriteClient` now accepts either a browser-wallet config
  (`account` + EIP-1193 `provider`) or `{ privateKey }` for this
  server-side path (`packages/contract-client/src/write-client.ts`'s
  `createServerWriteClient`, using genlayer-js's `createAccount` to sign
  locally with no injected provider needed).
- If `RESOLVER_PRIVATE_KEY` isn't set (e.g. local dev), the resolver logs
  once and no-ops rather than crashing the app — automated resolution is
  an operational nicety on top of the still-functional manual "Request
  Adjudication" button, not a hard requirement.

## Consequences

- A dispute now settles within ~5 minutes of its evidence deadline
  passing, without anyone needing to notice or click anything.
- The manual button remains as a fallback (e.g. if the resolver's wallet
  runs out of gas, or the cron misses a run for any reason) and because
  the underlying contract call is permissionless regardless of who
  triggers it.
