# Story 22 — In-App Notification Delivery

## Prerequisites

- `realtime-socketio-foundation` Story 20 completed: `RealtimeModule`/`RealtimeGateway` (`apps/api/src/realtime/`), the `branch:{id}:notifications` room and its existing authorization rule (`RealtimeGateway.authorizeRoom`, pure claims comparison, no DB lookup), and `TicketRealtimeListener` — the exact structural precedent this story's new listener mirrors. None of Story 20's code is modified.
- `sla-timer-detection-foundation` Story 15 completed: `SLA_AT_RISK_EVENT`/`SLA_BREACHED_EVENT` (`apps/api/src/modules/sla-policies/sla-detection.events.ts`), emitted by `SlaTimerEventsBridgeProcessor`. Not modified by this story.
- `sla-breach-escalation` Story 17 completed: `TICKET_ESCALATED_EVENT`/`TicketEscalatedEvent` (`apps/api/src/modules/tickets/tickets.events.ts`), emitted by `TicketEscalationListener.onSlaEscalated`. Not modified by this story.
- `sla-at-risk-notification-reaction` Story 18 and `ticket-escalation-notification-reaction` Story 19 completed: `NotificationLog` and its two existing listeners (`SlaAtRiskNotificationListener`, `TicketEscalatedNotificationListener`). Neither is modified, extended, or read by this story — this story is a second, independent consumer of the same three domain events, not a change to the notification-logging path.
- The intake this plan was generated from (`.squad/stories/in-app-notification-delivery/in-app-notification-delivery/intake.md`) records the approved product decision for this first iteration: **branch-wide, non-targeted broadcast** — every agent connected to `branch:{branchId}:notifications` receives every relayed event for that branch; no per-user recipient resolution, no preferences, no templates. This plan does not revisit that decision.

---

## Story Goal

Give the `branch:{id}:notifications` room (Story 20) its first publishers: relay `SLA_AT_RISK_EVENT`, `SLA_BREACHED_EVENT`, and `TICKET_ESCALATED_EVENT` — three already-existing, already-emitted domain events — into `branch:{branchId}:notifications` via a new `EventEmitter2` listener, structurally identical to `TicketRealtimeListener` (Story 20). This closes the one remaining gap this session's own recon identified: the room and its authorization exist, but nothing publishes into it.

**Not in scope** (per the intake's explicit "Out of scope" list, reaffirmed here after discovery): per-user recipient resolution or targeting; notification preferences; notification templates/localization; a general-purpose `NotificationService` or routing framework; a notifications BullMQ queue or worker; delivery retries/status tracking; read/unread state or a per-user inbox; any external channel (email/SMS/WhatsApp); the Channels domain; Customer Portal notification delivery; live chat; agent presence; any change to SLA detection/calculation, ticket escalation business rules, or `NotificationLog`; any new Socket.IO room type or second realtime transport; `AutomationRule`; frontend notification UI.

---

## Context — Read These Files First

1. `apps/api/src/realtime/ticket-realtime.listener.ts` (39 lines, read in full) — the exact structural precedent this story's new listener mirrors: `@Injectable()`, constructor-injects `RealtimeGateway`, one `@OnEvent` handler per subscribed event, a private `relay(eventName, roomKey, payload)` helper that calls `this.gateway.server.to(room).emit(eventName, payload)` inside a try/catch, `Logger.error` on failure, never rethrows. This story's new listener reuses this exact shape, targeting `branch:{branchId}:notifications` instead of `ticket:{id}`.
2. `apps/api/src/realtime/realtime.gateway.ts` lines 92–113 (`authorizeRoom`, read in full) — line 36, `server!: Server` is a public field other providers can call `.to(room).emit(...)` on (exactly as `TicketRealtimeListener` already does). Lines 102–105: the `branch:{id}:notifications` authorization rule is a **pure claims comparison** (`claims.branchId !== null && branchMatch[1] === claims.branchId`) — no Prisma lookup, unmodified by this story. This is the sole enforcement point for branch isolation; this story's new listener does no authorization of its own — it only picks which room to publish into.
3. `apps/api/src/realtime/realtime.module.ts` (22 lines, read in full) — `providers: [RealtimeGateway, TicketRealtimeListener]` (line 20); this story's new listener is appended. `imports: [AuthModule]` (line 19) is unrelated to this story — the new listener needs no `JwtService`.
4. `apps/api/src/modules/sla-policies/sla-detection.events.ts` (22 lines, read in full) — `SLA_AT_RISK_EVENT` (line 1) / `SlaAtRiskEvent` (line 14) and `SLA_BREACHED_EVENT` (line 2) / `SlaBreachedEvent` (line 17). Both extend `SlaDetectionEventBase` (lines 6–11): `{ ticketId: string; branchId: string; targetType: SlaTargetType; targetAt: Date }` — **`branchId` is already present directly on both payloads**, so relaying either requires zero additional lookup.
5. `apps/api/src/modules/sla-policies/sla-escalation.listener.ts` (62 lines, read in full) — confirms `SLA_BREACHED_EVENT` (line 30) is the event `SlaEscalationListener` itself reacts to, persisting `SlaEscalation` and then emitting `SLA_ESCALATED_EVENT` (line 55) — a distinct, Ticketing-adjacent translation event this story does **not** relay (Design item 1). Not modified by this story.
6. `apps/api/src/modules/tickets/tickets.events.ts` lines 33–46 (read in full) — `TICKET_ESCALATED_EVENT` (line 33) / `TicketEscalatedEvent` (lines 43–46): `{ ticket: TicketSummary; actorUserId: string | null }`. `TicketSummary` carries **no `branchId`** — relaying this event requires a minimal Prisma lookup by `event.ticket.id`.
7. `apps/api/src/modules/tickets/ticket-escalation.listener.ts` (57 lines, read in full) — the precedent for that lookup: `prisma.ticket.findUnique({ where: { id: event.ticketId }, select: {...} })` (lines 31–44), with a `if (!ticket) { return; }` defensive guard (lines 45–47) when the ticket cannot be found. This story's own lookup uses the identical minimal-`select` convention (`select: { branchId: true }`), matching `RealtimeGateway.authorizeRoom`'s own ticket lookup (Context item 2) rather than the fuller `TicketSummary` shape — only `branchId` is needed here.
8. `apps/api/src/realtime/ticket-realtime.listener.spec.ts` (64 lines, read in full) — the exact hand-built-mock unit-test precedent (`buildGatewayMock()` lines 6–10, one test per relay, one "does not throw when `server.to(...).emit(...)` throws" test) this story's new unit spec follows.
9. `apps/api/src/realtime/realtime.gateway.spec.ts` lines 149–157 (read in full) — the existing, unmodified unit proof that `branch:{id}:notifications` join authorization is already branch-isolated (`allows joining ... only for the caller's own branch`). This story does not need to re-prove branch-isolation at the authorization layer — only that its own relay always targets the room matching the event's own `branchId`, never a global broadcast.
10. `apps/api/test/realtime-socketio-foundation.e2e-spec.ts` (262 lines, read in full) — the exact e2e precedent this story's own new suite follows: `app.listen(0)` for a real bound port (no prior e2e suite besides this one needs it), `RedisIoAdapter` wired the same way, a real `socket.io-client` (`connect`/`waitForConnect`/`waitForEvent`/`join` helpers, lines 76–124), and `moduleRef.get(EventEmitter2)` used to emit a real event directly rather than driving the full upstream SLA-timer chain (matching `ticket-escalation-notification.e2e-spec.ts`'s own "emit directly, don't drive the whole chain" convention).
11. `apps/api/test/tickets.e2e-spec.ts` lines 79–83 (read in full, `GET /api/v1/auth/me` returning `me.body.branchId`) — the existing precedent for reading the logged-in admin's own real `branchId` inside an e2e suite; this story's new suite reuses this to join the admin's own real `branch:{id}:notifications` room.
12. `apps/api/src/app.module.ts` line 41 (read in full) — `RealtimeModule` is already imported and registered; **no `AppModule` change is needed** for this story.

---

## Design (resolved during this planning pass, per the intake's explicit delegation)

1. **Relay `SLA_BREACHED_EVENT` directly — not via `SLA_ESCALATED_EVENT`.** The intake's acceptance criteria allow relaying `sla.breached` "directly or through the existing escalation/event chain where that is the established architecture." `SLA_BREACHED_EVENT` already carries `branchId` (Context item 4) and requires no dependency on whether `SlaEscalationListener`'s own persistence succeeds or dedupes (Context item 5) — subscribing to the raw event directly is the simplest, most direct connection, with no coupling to a different listener's internal success path. `SLA_ESCALATED_EVENT` itself is **not** relayed — it exists to derive the Ticketing-owned `ticket.escalated` event (Context item 5), not as a notification-worthy signal in its own right; relaying it in addition to `ticket.escalated` would be a redundant duplicate notification for the same underlying transition, the same "avoid a duplicate message for one real transition" reasoning Story 20's own plan already applied to `ticket.recategorized`/`ticket.updated`.
2. **`SLA_AT_RISK_EVENT`/`SLA_BREACHED_EVENT` relay synchronously; `TICKET_ESCALATED_EVENT` relay is `async`.** The first two already carry `branchId` on their payload (Context item 4) — no lookup, no `await`, identical shape to `TicketRealtimeListener`'s existing synchronous handlers. `TICKET_ESCALATED_EVENT` has no `branchId` on its payload (Context item 6) and needs one minimal `prisma.ticket.findUnique({ where: { id }, select: { branchId: true } })` (Context item 7) before a room can be chosen — this one handler is `async`; the shared `relay()` helper itself stays synchronous and unchanged in shape.
3. **No new room, no new authorization code.** This story's listener only decides *which already-existing room* (`branch:{branchId}:notifications`) to call `.to(...).emit(...)` on — exactly mirroring how `TicketRealtimeListener` decides `ticket:{id}`. Branch isolation is enforced entirely by `RealtimeGateway.authorizeRoom`'s existing, unmodified rule (Context item 2): a socket can only be in `branch:X:notifications` if it already proved `claims.branchId === X` at join time. This story cannot leak across branches by construction, provided the relay always targets the room matching the event's own `branchId` — which Task 1's implementation and Task 1's unit tests both verify directly.
4. **Broadcast event name and payload: reuse verbatim, invent nothing.** Identical to Story 20's own Design item 10: the Socket.IO event name is the domain event's own constant value (`"sla.at_risk"`, `"sla.breached"`, `"ticket.escalated"`); the payload is the domain event's own shape, broadcast unmodified — no new DTO, no generalized notification envelope, matching the intake's explicit instruction.
5. **No `NotificationLog` interaction.** This story does not read, write, or reference `NotificationLog` in any way — it is a pure relay from `EventEmitter2` to Socket.IO, entirely independent of the existing record-only notification-logging listeners (Story 18/19), which continue to run unmodified and unaware of this story's existence.
6. **True per-branch e2e proof is limited by the existing seed; a same-mechanism proxy is used instead.** `apps/api/prisma/seed.ts` creates exactly one `Branch` (the same documented limitation `tickets.e2e-spec.ts`'s own doc comment already accepts for its own cross-branch cases). This story's e2e suite cannot authenticate two agents in two real, distinct branches. Instead, following that same established precedent, the isolation proof emits an event carrying a **different, unrelated `branchId`** than the one the connected client actually joined, and asserts the client receives nothing — exercising the exact same mechanism (the relay's room selection) that a true second branch would exercise, without requiring one. True branch-isolation at the *authorization* layer (can a socket join another branch's room at all) is already fully covered, unmodified, by Story 20's own existing unit tests (Context item 9).

---

## Implementation Tasks

### 1 — `BranchNotificationRealtimeListener`

Create file: `apps/api/src/realtime/branch-notification-realtime.listener.ts`

```typescript
import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { RealtimeGateway } from "./realtime.gateway";
import { PrismaService } from "../prisma/prisma.service";
import {
  SLA_AT_RISK_EVENT,
  SLA_BREACHED_EVENT,
} from "../modules/sla-policies/sla-detection.events";
import type { SlaAtRiskEvent, SlaBreachedEvent } from "../modules/sla-policies/sla-detection.events";
import { TICKET_ESCALATED_EVENT } from "../modules/tickets/tickets.events";
import type { TicketEscalatedEvent } from "../modules/tickets/tickets.events";

/**
 * Relays three already-existing domain events into `branch:{id}:notifications`
 * (Story 20) — the approved first iteration of in-app notification delivery:
 * branch-wide, non-targeted broadcast, no recipient resolution (Design
 * items 1–4). Structurally mirrors `TicketRealtimeListener`: one `@OnEvent`
 * handler per event, a shared synchronous `relay()` helper, try/catch,
 * `Logger.error` on failure, never rethrows. Does not read or write
 * `NotificationLog` — entirely independent of `SlaAtRiskNotificationListener`/
 * `TicketEscalatedNotificationListener` (Design item 5).
 */
@Injectable()
export class BranchNotificationRealtimeListener {
  private readonly logger = new Logger(BranchNotificationRealtimeListener.name);

  constructor(
    private readonly gateway: RealtimeGateway,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent(SLA_AT_RISK_EVENT)
  onSlaAtRisk(event: SlaAtRiskEvent): void {
    this.relay(SLA_AT_RISK_EVENT, event.branchId, event);
  }

  @OnEvent(SLA_BREACHED_EVENT)
  onSlaBreached(event: SlaBreachedEvent): void {
    this.relay(SLA_BREACHED_EVENT, event.branchId, event);
  }

  @OnEvent(TICKET_ESCALATED_EVENT)
  async onTicketEscalated(event: TicketEscalatedEvent): Promise<void> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: event.ticket.id },
      select: { branchId: true },
    });
    if (!ticket) {
      return;
    }
    this.relay(TICKET_ESCALATED_EVENT, ticket.branchId, event);
  }

  private relay(eventName: string, branchId: string, payload: unknown): void {
    try {
      this.gateway.server.to(`branch:${branchId}:notifications`).emit(eventName, payload);
    } catch (error) {
      this.logger.error(`Failed to relay ${eventName} for branch ${branchId}`, error as Error);
    }
  }
}
```

### 2 — Register the listener

File: `apps/api/src/realtime/realtime.module.ts`

Change (current line 20):

```typescript
  providers: [RealtimeGateway, TicketRealtimeListener],
```

to:

```typescript
  providers: [RealtimeGateway, TicketRealtimeListener, BranchNotificationRealtimeListener],
```

Add the import alongside the existing one (current line 4):

```typescript
import { BranchNotificationRealtimeListener } from "./branch-notification-realtime.listener";
```

### 3 — No `AppModule` change

`RealtimeModule` is already imported and registered (Context item 12) — no change needed.

### 4 — No schema/migration, no `NotificationLog` change

This story persists nothing (Design item 5) — no Prisma schema edit, no migration.

### 5 — Unit tests

Create file: `apps/api/src/realtime/branch-notification-realtime.listener.spec.ts`

Mirror `ticket-realtime.listener.spec.ts`'s hand-built-mock style (Context item 8): a `buildGatewayMock()` identical in shape, plus a `buildPrismaMock()` returning `{ ticket: { findUnique: vi.fn() } }`. Cover:
- `onSlaAtRisk` relays into `branch:{event.branchId}:notifications` with the unmodified event payload.
- `onSlaBreached` relays into `branch:{event.branchId}:notifications` with the unmodified event payload.
- `onTicketEscalated` calls `prisma.ticket.findUnique` with `{ where: { id: event.ticket.id }, select: { branchId: true } }`, then relays into `branch:{resolvedBranchId}:notifications` with the unmodified event payload.
- `onTicketEscalated` does not relay (gateway `.to` not called) when the ticket lookup resolves `null`.
- Neither `onSlaAtRisk` nor `onSlaBreached` throws when `server.to(...).emit(...)` throws (caught and logged).
- `onTicketEscalated` does not throw when the Prisma lookup itself rejects (caught and logged), mirroring `ticket-escalation.listener.spec.ts`'s own "does not throw when the Prisma read fails" case.

### 6 — Integration/e2e tests

Create file: `apps/api/test/in-app-notification-delivery.e2e-spec.ts` per Test Plan below.

---

## Edge Cases & Failure Modes

- **`SLA_AT_RISK_EVENT`/`SLA_BREACHED_EVENT` fires with no socket currently joined to that branch's `branch:{id}:notifications` room:** `server.to(room).emit(...)` on an empty room is a documented Socket.IO no-op (same as Story 20's own precedent) — no error, no queued delivery.
- **`TICKET_ESCALATED_EVENT` fires for a ticket id that cannot be found** (defensive edge case — `TICKET_ESCALATED_EVENT` is only ever emitted after `TicketEscalationListener` itself already re-fetched the same ticket successfully, Context item 7, so this should not be reachable in practice, but is defended against anyway, matching this codebase's own "never rely solely on an upstream guarantee" convention): `onTicketEscalated` returns without relaying — enforced at Task 1's `if (!ticket) { return; }` guard.
- **`server.to(...).emit(...)` throws for any of the three events:** caught and logged at `error` level, never rethrown — enforced at the shared `relay()` helper (Task 1), identical to `TicketRealtimeListener`'s own unmodified behavior.
- **The Prisma lookup in `onTicketEscalated` itself throws** (e.g. a transient DB error): not caught by `relay()` (which is never reached) — this async handler's own rejection is swallowed by `EventEmitter2`'s standard fire-and-forget handling of async listeners, the same behavior every other `async` `@OnEvent` handler in this codebase already relies on; no explicit try/catch is added around the lookup itself beyond what the unit test in Task 5 verifies does not crash the process.
- **The same underlying SLA transition also produces a `NotificationLog` row via `SlaAtRiskNotificationListener`/`TicketEscalatedNotificationListener`:** both reactions run independently against the same source event — this story's relay and the existing logging listeners never read each other's state, so neither can affect the other's success or failure (Design item 5).
- **A connected agent has not joined `branch:{id}:notifications` at all** (e.g. only joined a `ticket:{id}` room): they receive nothing from this story's relay — Socket.IO room membership is per-room, not implied by any other room the socket is in.

---

## Test Plan

1. **Unit — `apps/api/src/realtime/branch-notification-realtime.listener.spec.ts` (new):** see Task 5.
2. **Integration — `apps/api/test/in-app-notification-delivery.e2e-spec.ts` (new):** real `AppModule`, real Postgres/Redis, `app.listen(0)` for a live port (Context item 10), a real `socket.io-client`. Setup: log in as the seed admin, read `me.body.branchId` (Context item 11) for the real branch id to join. Scenarios:
   - Connect, join `branch:{realBranchId}:notifications` (acked `{ ok: true }` — Story 20's own unmodified authorization), then `moduleRef.get(EventEmitter2).emit(SLA_AT_RISK_EVENT, { ticketId, branchId: realBranchId, targetType: "response", targetAt: new Date() })`; assert the client receives the event on `"sla.at_risk"` with the same payload.
   - Same shape for `SLA_BREACHED_EVENT` → `"sla.breached"`.
   - Create a real ticket (via the HTTP API, so its `branchId` is the real admin branch), join `branch:{realBranchId}:notifications`, emit `TICKET_ESCALATED_EVENT` with that ticket's id; assert the client receives `"ticket.escalated"` with the ticket id.
   - **Isolation proxy** (Design item 6): join `branch:{realBranchId}:notifications`, emit `SLA_AT_RISK_EVENT` with a **different, random `branchId`**; assert the client receives nothing within a short timeout (the `waitForEvent`-style helper rejecting on timeout is the expected, asserted outcome).
3. **Regression:** the full existing `apps/api` unit + e2e suite, in particular `realtime-socketio-foundation.e2e-spec.ts` (Story 20's own suite, must remain unaffected — this story adds a second listener, it does not touch `RealtimeGateway`/`TicketRealtimeListener`/`RedisIoAdapter`), `sla-at-risk-notification.e2e-spec.ts` and `ticket-escalation-notification.e2e-spec.ts` (Story 18/19's `NotificationLog` behavior must remain byte-for-byte unaffected), and `apps/worker`'s own suites (untouched by this story).

---

## Migration / Rollback

None. No Prisma schema change, no new table, no new column — this story only adds a new `EventEmitter2` listener and registers it as a provider. Rollback is a plain code revert; no data cleanup of any kind is needed.

---

## Verification Steps

1. **Backend builds:** `pnpm --filter @crm/api typecheck`, `lint`, `build`.
2. **Workspace builds:** `pnpm typecheck`, `pnpm lint`, `pnpm build` at the repository root.
3. **Unit tests:** `pnpm --filter @crm/api test`.
4. **Live infra:** `docker compose up -d postgres redis` (temporary `5433` fallback if the native PostgreSQL service is again occupying `5432` — revert immediately after, exactly as prior stories did).
5. **Integration tests:** `pnpm --filter @crm/api test:e2e`. Run at least twice to confirm no flakiness from the socket-connection/event-relay timing.
6. **Regression:** confirm the full existing `apps/api` unit + e2e suite is otherwise unaffected, in particular `realtime-socketio-foundation.e2e-spec.ts`, `sla-at-risk-notification.e2e-spec.ts`, `ticket-escalation-notification.e2e-spec.ts`, and `apps/worker`'s own unit/e2e suites (untouched by this story).
7. **Hygiene:** `git status`; confirm `.squad/config.yaml` has an empty diff; confirm `apps/api/src/realtime/realtime.gateway.ts`, `apps/api/src/realtime/redis-io.adapter.ts`, `apps/api/src/realtime/ticket-realtime.listener.ts`, `apps/api/prisma/schema.prisma`, every SLA-policies listener file, and every existing Notifications-domain listener file all have empty diffs.
8. **CI:** `gh run list --workflow=ci.yml --limit 5` if `gh` is reachable; otherwise report CI verification as explicitly pending — never assumed.

## Done Criteria

- [ ] `SLA_AT_RISK_EVENT` is relayed into `branch:{branchId}:notifications`.
- [ ] `SLA_BREACHED_EVENT` is relayed into `branch:{branchId}:notifications`, subscribed to directly (not via `SLA_ESCALATED_EVENT`).
- [ ] `TICKET_ESCALATED_EVENT` is relayed into `branch:{branchId}:notifications`, with the ticket's branch resolved via a minimal Prisma lookup.
- [ ] No new Socket.IO room type, no second realtime transport — only Story 20's existing `branch:{id}:notifications` room is used.
- [ ] No change to `RealtimeGateway`'s authorization rule — branch isolation is enforced entirely by Story 20's existing, unmodified `authorizeRoom` logic.
- [ ] An e2e-verified agent joined to their own branch's room receives all three relayed events; the same agent does not receive an event carrying a different branch id (isolation proxy, Design item 6).
- [ ] No recipient/user targeting, no notification preferences, no templates, no localization are introduced.
- [ ] No `NotificationLog` schema change; no read or write of `NotificationLog` by this story's new code.
- [ ] No new BullMQ queue, no `apps/worker` change, no new HTTP endpoint.
- [ ] Existing Story 15/17/18/19/20 emitters, listeners, and behavior are byte-for-byte unchanged.
- [ ] Unit and integration/e2e tests exist and pass per the Test Plan above.
- [ ] `.squad/config.yaml` is untouched.
- [ ] Full existing lint/typecheck/build/test suite (every prior story through Story 21) still passes with no regressions.
- [ ] `git status` shows no unrelated changes after implementation.

---

**STOP HERE. Report to the user and wait for confirmation before implementing.**
