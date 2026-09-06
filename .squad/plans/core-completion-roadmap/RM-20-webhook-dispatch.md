# RM-20 — Webhook Subscriptions + Outbound Event Dispatch

**Priority:** P0/P1 · **Complexity:** Medium · **Blocked:** No · **Phase:** 6 (Integration Platform)

## Goal

Let an admin register an outbound webhook subscription against a domain
event, and have it fire (with retry/backoff) whenever that event occurs —
the generic half of the "Integration Hub" `docs/architecture/09-
integrations.md` describes but that does not exist in code.

## Why it exists

Core 11 (Integrations) names "External systems" explicitly; the
architecture docs describe an `IntegrationsModule`/`integrations` schema in
full detail with zero code behind it (confirmed: no `integrations` schema
in `schema.prisma`'s `datasource.schemas` array, no matching module
anywhere). This is the single highest-leverage, fully zero-cost, fully
unblocked gap in the whole Integrations domain — it needs no external
provider decision at all.

## Dependencies

None. Reuses existing BullMQ (already proven for SLA timers/AI processing)
and the existing event bus (`@nestjs/event-emitter`, already used
throughout Ticketing/SLA/Notifications).

## Backend work

- New `integrations` Postgres schema (mirrors how Reporting added its own
  dedicated schema in Story 110 the first time it needed to own a table).
- `WebhookSubscription` model: `id`, `branchId`, `targetUrl`, `secret`
  (for HMAC signing outbound payloads), `subscribedEventTypes` (string
  array — e.g. `ticket.updated`, `ticket.escalated`), `isActive`,
  `createdByUserId`, `createdAt`.
- Admin CRUD: `POST/GET/PATCH/DELETE /integrations/webhook-subscriptions`,
  gated by a new `integration:manage` permission.
- A generic outbound-dispatch listener subscribing broadly to the existing
  domain event bus, checking active subscriptions per event type, and
  enqueuing a dispatch job per matching subscription onto a new
  `webhook-dispatch` BullMQ queue (mirrors `sla-timers`'s existing
  registration pattern) — HMAC-signs the payload with the subscription's
  own `secret`, POSTs to `targetUrl`, records success/failure with the
  existing BullMQ retry/backoff shape.
- Every dispatch attempt (success or failure) writes an audit-style log row
  (`WebhookDeliveryAttempt` — reuses the `AuditLog` append-only pattern's
  spirit, not necessarily the same table) for admin visibility.

## Frontend work

- Admin UI for managing webhook subscriptions (create/list/deactivate),
  mirroring the existing admin-CRUD screens' shape (e.g.
  `automation-rules`'s own list/create pattern).
- A delivery-attempt log view per subscription (success/failure history).

## Worker/realtime work

New `webhook-dispatch` queue + `apps/worker` processor performing the
signed HTTP POST with retry/backoff.

## Schema/migration work

New `integrations` schema, `WebhookSubscription` and
`WebhookDeliveryAttempt` models, one migration. `crm_app` runtime-role
grants extended to cover the new schema (mirrors Story 110/115's own
established pattern for adding a new schema's grants).

## Tests

- `webhook-subscriptions.service.spec.ts` — CRUD, branch scoping.
- New processor spec — successful dispatch, retry-then-succeed, retry-
  exhausted-then-failed, correct HMAC signature on the outbound payload.
- e2e: registering a subscription and observing a real dispatch attempt
  (target a local test HTTP server, not an external service — zero cost).

## Acceptance criteria

- An admin can register a webhook subscription and see it fire (with
  retry) on a real domain event (e.g. `ticket.updated`).
- Every attempt, successful or not, is visible in a delivery-attempt log.
- No external service or cost is required to test this end-to-end.

## Definition of Done

- All acceptance criteria verified.
- `pnpm --filter @crm/api test`, `test:e2e`, `pnpm --filter @crm/worker test`,
  `pnpm typecheck`, `pnpm lint`, `pnpm build` pass.
- One dedicated commit, pushed.
