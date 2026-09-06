# RM-21 — Inbound Webhook Receiver + Signature Verification Framework

**Priority:** P1 · **Complexity:** Medium · **Blocked:** No · **Phase:** 6 (Integration Platform)

## Goal

A generic, pluggable inbound webhook route with swappable signature
verification, so a future provider adapter (ERP, or a Phase 5 channel) can
receive webhooks without inventing its own receiving infrastructure.

## Why it exists

`docs/architecture/09-integrations.md` describes inbound provider webhooks
being "signature-verified, written to `integrations.webhook_logs`, and
translated into `ChannelMessage` or ERP domain events" — none of this
exists in code. Building the generic receiver now (independent of which
specific provider eventually uses it) is exactly the kind of provider-
neutral foundation Phase 6 is meant to establish.

## Dependencies

`RM-20` (shares the new `integrations` schema and its permission/audit
conventions). No dependency on any specific provider decision.

## Backend work

- A generic `POST /integrations/webhooks/:providerKey` route, `@Public()`
  (necessarily unauthenticated by JWT — provider webhooks don't carry a
  bearer token) but signature-verified per a pluggable
  `WebhookVerifier` interface resolved by `providerKey` (mirrors `RM-14`'s
  `ChannelAdapterRegistry` shape — a registry of verifiers, not one
  hard-coded scheme).
- Every inbound payload, verified or not, is written to a
  `WebhookInboundLog` table (`integrations` schema) before any further
  processing — an unverifiable/unrecognized payload is logged and
  rejected (401/403), never silently dropped without a trace.
- Rate-limited at least as tightly as the existing `web-form-intake`
  public-route precedent (20/60s), since this is another anonymous public
  endpoint.
- No real verifier is registered yet (no provider exists to receive from) —
  this story ships the framework with zero registered verifiers, exactly
  like `RM-14` shipped its registry with zero Email/WhatsApp/SMS adapters
  registered.

## Frontend work

- An admin view of `WebhookInboundLog` (received payloads, verification
  outcome) — visibility/auditability, mirroring the outbound
  delivery-attempt log `RM-20` added.

## Worker/realtime work

None — inbound receipt is synchronous (verify, log, 200/401); any further
processing (translating into a `ChannelMessage`/domain event) is deferred
to whichever future provider-specific story registers a verifier.

## Schema/migration work

`WebhookInboundLog` model in the `integrations` schema (from `RM-20`), one
migration.

## Tests

- `webhook-inbound.controller.spec.ts` — a recognized `providerKey` with a
  valid signature is logged and accepted; an invalid signature is logged
  and rejected; an unrecognized `providerKey` is logged and rejected.
- Rate-limit test mirroring `channels-web-form.e2e-spec.ts`'s own pattern.

## Acceptance criteria

- A test payload is signature-verified (using a test verifier registered
  only for this test) and routed correctly; every attempt is visible in
  the inbound log regardless of outcome.
- No real external provider is required to prove this end-to-end.

## Definition of Done

- All acceptance criteria verified.
- `pnpm --filter @crm/api test`, `test:e2e`, `pnpm typecheck`, `pnpm lint`,
  `pnpm build` pass.
- One dedicated commit, pushed.
