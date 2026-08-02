# Contributing to Veritine

This is currently a single-maintainer project in active early development.
Contribution guidelines will be expanded once the core product ships.

## Development principles

- No placeholder or mocked implementations in code presented as complete.
- The GenLayer Intelligent Contract is the source of truth for all
  contract-owned state (stakes, adjudication results, rewards, slashing).
  The backend indexes and reconciles — it never overrides.
- Follow the escrow/value-transfer ordering discipline documented in
  `docs/contracts/` for any code that moves GEN.
