# 0002 — Economic model approved

Date: 2026-08-02

## Status

Approved.

## Decision

See `docs/architecture/PHASE_1_ARCHITECTURE.md` §10 for the full
evidence-outcome → stake-outcome table. Summary:

- Slash tiers range from 0% (strongly supported / credible+relevant /
  credible-but-limited / inconclusive / outdated-not-deceptive) up to 100%
  (fabricated/unverifiable, maliciously manipulated).
- Slashed pool: 90% to winning-side stakers (proportional), 10% to
  protocol treasury.
- Protocol fee: 2% on reward payouts only (never on refunds or returned
  principal), routed to treasury.
