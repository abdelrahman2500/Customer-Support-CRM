# RM-13 — Channel Message Delivery Status &amp; Retry Model

**Priority:** P1 · **Complexity:** Medium · **Blocked:** No · **Phase:** 4 (Omnichannel Foundation)

## Goal

Extend `ChannelMessage` with a delivery-lifecycle model
(queued/sent/delivered/failed, retry count, failure reason) so a genuinely
externally-delivered channel (Email/WhatsApp/SMS, once unblocked) has
somewhere correct to record what actually happened to an outbound message.

## Why it exists

`ChannelMessage` today (`schema.prisma`) has no delivery-status field of
any kind — confirmed by reading the model in full. This is not an oversight
in the existing Live Chat/Web Form implementation; both are first-party,
always-instantly-"delivered" channels with no external transport, so
neither ever needed one. Any channel that goes over a real network to a
real external system needs this concept, and none of Phase 5's stories can
be built correctly without it existing first.

## Dependencies

None technically, but this is a hard prerequisite for `RM-15`/`RM-17`/`RM-18`
(every Phase 5 outbound adapter needs somewhere to record delivery
status/retries).

## Backend work

- Extend `ChannelMessage` with: `deliveryStatus` (enum:
  `PENDING`/`SENT`/`DELIVERED`/`FAILED` — `PENDING`/`SENT`/`DELIVERED` only
  meaningful for `OUTBOUND` messages on an externally-delivered channel;
  existing Live Chat/Web Form/AI_CHAT messages get `DELIVERED` immediately
  at creation, preserving their current always-succeeds behavior exactly),
  `externalMessageId` (nullable — the provider's own message id, once a
  provider exists), `failureReason` (nullable text), `retryCount` (default
  0).
- A generic outbound-delivery queue (new BullMQ queue, mirroring
  `sla-timers`/`ai-processing`'s existing registration pattern in
  `queues.module.ts`), with retry/backoff configured the same way those
  queues already are — this queue is the mechanism a future channel adapter
  enqueues an outbound send onto; it does no channel-specific work itself
  (no adapter exists yet to plug in).
- `ChannelMessagesService` gains a `markDelivered`/`markFailed` method pair
  a future adapter's worker-side processor will call — implemented and
  tested now against a no-op/test adapter, so the seam is proven before any
  real provider exists.

## Frontend work

- `TicketChatCard`/portal equivalent: render a small delivery-status
  indicator (a subtle icon/label) on outbound messages once
  `deliveryStatus` is anything other than the existing implicit
  "instantly delivered" state — invisible for Live Chat/Web Form/AI_CHAT
  (they're always `DELIVERED` immediately), only meaningful once Phase 5
  adds a real externally-delivered channel.

## Worker/realtime work

- New BullMQ queue + a minimal `apps/worker` processor stub (accepts a job,
  calls a no-op "adapter" that immediately marks the message `SENT`, proving
  the queue/status-update loop end-to-end before any real adapter exists).
- No new realtime event — status changes can ride the existing
  `channel.message.created`-shaped relay's payload, extended with the new
  fields.

## Schema/migration work

- Extend `ChannelMessage` with the four new fields above, one migration.
  Backfill: existing rows get `deliveryStatus: DELIVERED` (matching their
  actual, already-true state).

## Tests

- `channel-messages.service.spec.ts` — extend for `markDelivered`/
  `markFailed`, and for the backfill/default-`DELIVERED`-for-first-party-
  channels behavior.
- New processor spec for the no-op adapter loop.

## Acceptance criteria

- Every existing Live Chat/Web Form/AI_CHAT message continues to behave
  exactly as before (implicitly, immediately `DELIVERED`) — zero behavior
  change for what's already shipped.
- The new queue/status-update loop is proven end-to-end against a no-op
  test adapter, ready for `RM-14`'s real adapter registry to plug into.

## Definition of Done

- All acceptance criteria verified.
- `pnpm --filter @crm/api test`, `test:e2e`, `pnpm --filter @crm/worker test`,
  `pnpm typecheck`, `pnpm lint`, `pnpm build` pass.
- One dedicated commit, pushed.
