# Security

This document reflects the Phase 11 (Security and Hardening) review of the
Veritine build, conducted 2026-08-02.

## Security model

Veritine's trust boundary is intentionally narrow: the GenLayer Intelligent
Contract is the sole source of truth for stakes, adjudication verdicts, and
economic outcomes (see `docs/security/CONTRACT_SECURITY.md` for the
contract-level threat model). The backend is an indexer/cache — it can be
wrong, stale, or fully rebuilt from the chain at any time without any loss
of user funds or state, because it never independently computes or stores
anything money-related outside of what it read from the contract.

## Responsible disclosure

This is an early-stage, single-maintainer project. If you find a
vulnerability, please report it privately rather than opening a public
issue until a fix has shipped.

## Review scope and findings (Phase 11)

### Authentication / wallet
- Wallet-based auth (Option 2 from the project's requirements) — no
  custodial private keys are ever stored, generated, or handled by this
  application. This eliminates the entire private-key-custody risk
  surface the project's spec calls out for the email/password option.
- Nonce-challenge sign-in: single-use nonces (`consumedAt` set atomically
  on verification), 5-minute TTL, EIP-191 signature recovery via `ethers`.
  Verified end-to-end in Phase 5 with a real signed message, including
  replay-attack rejection.
- Session cookies: `httpOnly`, `secure` in production, `SameSite=strict`
  (mitigates CSRF without needing a separate CSRF token scheme, since
  strict same-site cookies are never sent on cross-site requests).

### API hardening (added this phase)
- **Secure headers** via `helmet` — CSP (`default-src 'none'`, since this
  API serves no HTML of its own), HSTS, `X-Content-Type-Options: nosniff`,
  `X-Frame-Options`, and friends. Verified live via `curl -I`.
- **Request body size limit** — 256KB cap on JSON/urlencoded bodies via
  Express middleware. Verified: a 300KB payload is rejected with `413`.
- **Rate limiting** — a global default (`60 req/min` per IP) plus tighter
  per-route overrides: `20/min` on nonce issuance, `2 per 5 minutes` on
  the indexer sync trigger. Verified via response headers and by
  triggering the limit directly.
- **CORS** — restricted to `FRONTEND_URL` with credentials, not a wildcard.
- **Environment validation** — every required variable is validated with
  `zod` at startup (`loadBackendEnv`/`loadFrontendEnv`); the app refuses
  to boot with a clear, itemized error rather than silently running with
  missing configuration.
- **Operational endpoint protection** — `POST /indexer/sync` fans out into
  real GenLayer RPC calls, and StudioNet's public RPC has a hard cap of
  **5,000 requests/day** (hit this during Phase 9 testing). Left
  unauthenticated, this endpoint would let anyone burn the platform's
  entire daily RPC quota with a handful of requests. Fixed with
  `InternalApiKeyGuard` (requires `INTERNAL_API_KEY` header in
  production) plus the tight rate limit above. Verified: missing/wrong
  key returns `401`; the rate limiter counts every attempt, including
  rejected ones, so an attacker cannot bypass throttling by intentionally
  failing auth first.
- **Input validation** — `zod` schemas for every write endpoint
  (`@veritine/validation`); read endpoints validate enum membership for
  status/category filters and clamp pagination bounds server-side.
- **No secrets in logs** — grepped the backend source for any logging of
  tokens, secrets, passwords, or signatures; none found.

### Contract / adjudication
See `docs/security/CONTRACT_SECURITY.md` for the full contract threat
model: escrow/reentrancy discipline, prompt-injection defenses for fetched
web content, consensus/validator substance-checking, spam/griefing
mitigations, and access control. Not re-litigated here.

### Dependency review
Ran `pnpm audit` across the workspace. Findings and disposition:

- **`next` (14.2.35)** has multiple high-severity advisories (DoS in
  Server Components/Image Optimization, SSRF in Server Actions/rewrites,
  cache poisoning, XSS in specific configurations) that are fixed in
  `15.5.21+`. **Not upgraded this phase** — the fix is a major version
  bump (Next 15 targets React 19) that risks breaking the working
  wagmi/Reown wallet-connect integration without dedicated regression
  testing, which this phase's time budget doesn't cover. Mitigating
  factors: this app doesn't use `next/image` with `remotePatterns`, a
  custom server, Pages Router i18n, or Server Actions — several of the
  advisories don't apply to Veritine's actual usage. **Flagged as the
  top follow-up item before a production launch.**
- **`multer`, `ws`, `axios`, `tmp`, `glob`, `lodash`, `picomatch`** — all
  transitive dependencies of the MetaMask SDK / WalletConnect / Reown
  AppKit stack, not called directly by Veritine's own code. No direct
  attack surface in this app (we don't accept file uploads, don't call
  `axios` ourselves, etc.) — these will resolve naturally as the wallet
  SDKs update their own dependency pins. Not something this project can
  fix independently without waiting on upstream.
- **`postcss`** — our own resolved version (`8.5.25`, via Tailwind) is
  already above every patched threshold in the advisories; the audit is
  flagging a different, older transitive copy pulled in elsewhere, not
  our direct usage.

## Known risks

- **Next.js 14 → 15 upgrade is outstanding** (see dependency review
  above) — schedule this with dedicated wallet-flow regression testing
  before production launch.
- **Single-owner contract admin** — `pause`/`unpause`/`set_fees`/
  `set_minimums`/`set_treasury_address`/`set_owner` are gated to one
  owner address with no multisig/timelock. Acceptable for an early-stage
  deployment; documented as a v1 limitation in
  `docs/security/CONTRACT_SECURITY.md`.
- **No admin UI/RBAC on the backend** — the backend has no authenticated
  admin role today; the one operational endpoint that needs protection
  (`/indexer/sync`) is gated by a shared secret rather than a full
  admin-auth system, which is a reasonable scope for this stage but
  would need revisiting if more admin-only backend endpoints are added.

## Web-source / LLM risks

Handled entirely at the contract level — see
`docs/security/CONTRACT_SECURITY.md`'s "Prompt injection / untrusted web
content" section. In short: every evidence-evaluation prompt explicitly
frames fetched page content as untrusted data, instructs the model never
to follow embedded instructions, and validators independently re-fetch
and re-derive verdicts rather than trusting the leader's output.

## User responsibilities

- You are responsible for your own wallet's private key — Veritine never
  has access to it (wallet-based auth, no custodial keys).
- GEN staked on a position or piece of evidence is at real economic risk
  per the approved slashing model (`docs/product/ECONOMIC_MODEL.md`) —
  understand the outcome tiers before staking.
- Evidence you submit is independently fetched and evaluated by GenLayer
  validators — submitting fabricated or manipulated evidence carries the
  most severe slash tier and an on-chain reputational flag.
