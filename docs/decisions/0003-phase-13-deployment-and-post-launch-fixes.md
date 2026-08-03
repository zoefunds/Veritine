# 0003 — Phase 13 deployment and post-launch fixes

Date: 2026-08-02

## Status

Deployed.

## Decision

Backend deployed to Fly.io (`veritine-api`, always-on), frontend to Vercel
(`veritine`). See `docs/deployment/DEPLOYMENT.md` for the full process.

The contract was later redeployed to a new address
(`0xe079aEaa565bca181FDfa0Cc275398701E23B0B5`); the old address's indexed
Postgres data was truncated rather than left to linger as stale/misleading
state (see `docs/deployment/DEPLOYMENT.md` § redeploying the contract).

## Bugs found and fixed post-launch

A number of real bugs surfaced once the platform had live users hitting it,
beyond what unit/direct-mode contract tests could catch:

- **`create_dispute` reverted on-chain**: the frontend sent
  `min_position_stake_wei`/`min_evidence_stake_wei` as JS strings; GenVM
  calldata is typed by the JS value's own type, not coerced from the
  contract's Python `int` hint, so the dispatcher rejected the call before
  any dispute logic ran. Fixed by sending `bigint` instead (matching how
  the deadline timestamps are already sent as plain numbers).
- **Every studionet write falsely reported "failed"**: the SDK's success
  check (`txExecutionResultName`) is only populated by
  `decodeTransaction`, the non-studio decode path. `decodeLocalnetTransaction`
  (used for studionet) never sets it — the real signal is per-leader-receipt
  at `consensus_data.leader_receipt[].execution_result` (`"SUCCESS"` |
  `"ERROR"`). Confirmed disputes were being created successfully the whole
  time despite the UI reporting failure.
- **Indexer never wrote `Evidence` or `PositionStake` rows at all** —
  `syncOneDispute` only ever upserted `Dispute`/`DisputePosition`. Every
  dispute's evidence list was silently empty regardless of what had been
  submitted on-chain, and there was no per-user record of who staked what
  (only the position's aggregate total existed). Fixed by syncing evidence
  from `get_evidence_for_dispute`, and deriving stakers from the
  append-only activity log (`get_activity`, filtered to `STAKE_POSITION`
  events) cross-checked against each staker's authoritative current amount
  via `get_position_stake`.
- **Dispute explorer showed disputes from an already-truncated database**:
  Vercel's Data Cache kept serving a stale response for a plain `fetch()`
  across deployments even with the route's `force-dynamic` config. Fixed
  by setting `cache: 'no-store'` (later `next: { revalidate: 5 }`, see
  below) explicitly on the fetch itself.
- **Dispute detail page crashed with a server-side exception**: the
  `minPositionStakeWei`/`minEvidenceStakeWei` fields were added to the
  frontend's dispute-detail type and fed into `formatGen()`/`BigInt()`,
  but the backend's `getOne` controller builds its response object
  field-by-field and didn't include them — `BigInt(undefined)` throws.
  Fixed on both ends: backend now includes the fields, frontend defaults
  to `'0'` if a response is ever missing them.

## Features added post-launch

- Redirect to the new dispute's detail page after `create_dispute`
  succeeds, syncing just that dispute first (bounded, ungated
  `POST /indexer/sync/:contractDisputeId`) rather than waiting on the
  5-minute cron.
- Minimum stake display + client-side enforcement on the stake/evidence
  forms, and in the dispute detail sidebar.
- `GET /users/by-wallet/:address/activity` + a "My Activity" section on
  the dashboard, so a connected wallet can see its own position stakes
  and evidence submissions across every dispute.
- Faster tx-status polling (1s vs 3s interval).
- Dispute list/detail/dashboard pages switched from `force-dynamic` +
  no-store to a 5s revalidate window — every navigation was a fully
  uncached round trip to Fly/Postgres, which made pages feel slow.
- Reduced the frontend type scale (display/headline/body/code/label
  tokens) — the original sizes read oversized across the site.
