# RM-15 — Email Adapter — Outbound (SMTP)

**Priority:** P1 · **Complexity:** Medium · **Blocked:** Partially — see below · **Phase:** 5 (Email/WhatsApp/SMS)

## Goal

Implement a real `ChannelAdapter` for `EMAIL` (outbound only), sending a
`ChannelMessage` over SMTP.

## Why it exists

Email is the one channel among Email/WhatsApp/SMS with a genuinely
self-hostable, open protocol — `02-product-decisions.md` Decision Record 1
confirms a zero-cost outbound path is plausible (self-hosted relay, or a
capped free-tier relay), unlike WhatsApp/SMS. `docker-compose.yml` already
runs Mailhog, a zero-cost SMTP sandbox no code currently talks to.

## Blocked status — read carefully

**The outbound send path itself is buildable and fully testable today**,
targeting Mailhog, with zero new cost and no pending decision. **What
remains genuinely blocked is a production rollout** to real customer
inboxes — that requires Phase 0 Decision Record 1's open choice (self-host
vs. a specific relay) and, for self-hosting, real DNS/SPF/DKIM/reputation
setup this repository cannot decide unilaterally. This story should be
implemented and merged with production email delivery left disabled by
configuration (no SMTP host configured in a real deployment's env = the
`EmailAdapter` correctly reports "no adapter configured," per `RM-14`'s own
graceful-absence behavior) until that decision is made.

## Dependencies

`RM-13` (delivery-status model), `RM-14` (adapter interface + registry).

## Backend work

- `EmailAdapter implements ChannelAdapter`: `send()` uses a standard SMTP
  client (e.g. `nodemailer`, MIT-licensed, zero cost) configured from new
  env vars (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, all
  following this repo's existing `.env.example` documentation convention —
  local dev points at Mailhog's `1025`, matching the already-running
  service).
- Register `EmailAdapter` in `ChannelAdapterRegistry` for `ChannelType.EMAIL`
  — from this point, an outbound `ChannelMessage(EMAIL, OUTBOUND)` actually
  attempts a real send instead of staying `PENDING`.
- MIME construction includes attachments via the existing
  `TicketAttachment`/S3 pattern (no new storage mechanism).
- Idempotency: keyed on the outbound `ChannelMessage.id`, matching
  `RM-13`'s established retry/backoff shape — a retried job never
  double-sends.

## Frontend work

- A "send by email" composer option in `TicketChatCard`, alongside the
  existing Live Chat composer — visible only when an `EMAIL` adapter is
  configured (mirrors how AI features already conditionally hide/show
  based on `AiSettings`; the equivalent check here is "is `SMTP_HOST`
  configured," surfaced via a small config-status endpoint or existing
  settings shape).

## Worker/realtime work

- `apps/worker`'s outbound processor (from `RM-13`/`RM-14`) now performs a
  real SMTP send for `EMAIL` messages, marking `SENT`/`FAILED` accordingly.

## Schema/migration work

None beyond `RM-13`'s.

## Tests

- Against the already-running Mailhog sandbox in CI/local dev: a real
  outbound send, verified by querying Mailhog's own API for the received
  message (Mailhog exposes a JSON API for exactly this purpose) — a
  genuine, zero-cost, non-mocked integration test.
- Idempotency/retry test: a simulated transient SMTP failure followed by a
  successful retry, asserting no duplicate message.

## Acceptance criteria

- A `ChannelMessage(EMAIL, OUTBOUND)` is genuinely delivered to and
  verifiable in Mailhog in local dev/CI.
- With no `SMTP_HOST` configured, the system behaves exactly as it does
  today (message stays `PENDING`, clearly logged as "no adapter
  configured") — never crashes, never silently drops.
- Production rollout (a real external SMTP relay) is explicitly gated on
  the Phase 0 decision — this story does not itself decide or hard-code a
  production relay.

## Definition of Done

- All acceptance criteria verified against Mailhog.
- `pnpm --filter @crm/api test`, `test:e2e`, `pnpm --filter @crm/worker test`,
  `pnpm typecheck`, `pnpm lint`, `pnpm build` pass.
- One dedicated commit, pushed. Completion report explicitly notes
  production delivery remains pending the Phase 0 product decision.
