# Story 21 — Ticket History & Timeline Completion

## Prerequisites

- [`ticketing` Story 09](../ticketing/09-story-ticket-history-timeline.md) completed: `TicketHistoryListener` (`apps/api/src/modules/tickets/ticket-history.listener.ts`), `TicketHistoryEntry` (`ticketing` schema), and the `GET /tickets/:id/history` read endpoint. This story extends that listener; it does not modify the model, the endpoint, or Story 09's original two `@OnEvent` handlers' existing behavior.
- `ticket-recategorization-sla-target-recomputation` Story 16 completed: `TICKET_RECATEGORIZED_EVENT`/`TicketRecategorizedEvent` (`apps/api/src/modules/tickets/tickets.events.ts`), emitted by `TicketsService.updateTicket`. Not modified by this story.
- `sla-breach-escalation` Story 17 completed: `TICKET_ESCALATED_EVENT`/`TicketEscalatedEvent` (same file), emitted by `TicketEscalationListener.onSlaEscalated`. Not modified by this story.
- No coordination with another domain's owner is required — this story touches only the `Ticketing` module's own existing listener and its own existing test files.

---

## Story Goal

`TicketHistoryListener` currently records a history entry for exactly two of the four events the `Ticketing` domain now emits (`ticket.created`, `ticket.updated`) — verified directly this session: it has never been revisited since `ticket.recategorized` (Story 16) and `ticket.escalated` (Story 17) were introduced, so a ticket's history/timeline is silently incomplete for both a recategorization and an escalation. This story closes that gap: `TicketHistoryListener` gains two more `@OnEvent` handlers, `onTicketRecategorized` and `onTicketEscalated`, both calling the exact same private `record()` helper the existing two handlers already use — no new persistence logic, no new model, no migration.

**Not in scope:** any change to `TicketsService`, `SlaTargetListener`, `TicketEscalationListener`, or any Notifications-domain listener; any new domain event; any new HTTP endpoint (the existing `GET /tickets/:id/history` already returns whatever rows exist for a ticket, ordered by `createdAt`); any frontend change; any `apps/worker`/BullMQ change; any Prisma schema or migration change.

---

## Context — Read These Files First

1. `apps/api/src/modules/tickets/ticket-history.listener.ts` (53 lines, read in full) — `@OnEvent(TICKET_CREATED_EVENT)` (line 22), `@OnEvent(TICKET_UPDATED_EVENT)` (line 27), and the shared `private record(eventType, event)` helper (lines 32–52) that does the actual `prisma.ticketHistoryEntry.create(...)` inside a try/catch, logging at `error` level on failure and never rethrowing. This story adds two more `@OnEvent` handlers that call this exact helper — no new logic is introduced. The class doc comment (lines 8–15) currently says "The first real subscriber to the events `TicketsService` emits (Story 08)" — update it to note it now covers all four Ticketing events, not just the two `TicketsService` emits directly.
2. `apps/api/src/modules/tickets/tickets.events.ts` (46 lines, read in full) — `TICKET_RECATEGORIZED_EVENT` (line 18) / `TicketRecategorizedEvent` (lines 28–31) and `TICKET_ESCALATED_EVENT` (line 33) / `TicketEscalatedEvent` (lines 43–46). Both interfaces are `{ ticket: TicketSummary; actorUserId: string | null }` — byte-for-byte the same shape `TicketCreatedEvent`/`TicketUpdatedEvent` already have (lines 7–10, 13–16). `record()`'s existing parameter type only needs widening to include the two new event types; no new field handling is needed.
3. `apps/api/src/modules/tickets/tickets.service.ts` lines 118–159 (`updateTicket`, read in full) — `TICKET_UPDATED_EVENT` is always emitted first (line 148); `TICKET_RECATEGORIZED_EVENT` is then conditionally emitted in the **same call** (lines 152–157) whenever `category`, `priority`, or `departmentId` changes. This means a single recategorizing `PATCH /tickets/:id` will, after this story, persist **two** history rows (`ticket.updated` then `ticket.recategorized`), not one — this drives Task 3 below, a required fix to an existing e2e assertion.
4. `apps/api/src/modules/tickets/ticket-escalation.listener.ts` (57 lines, read in full) — the sole emitter of `TICKET_ESCALATED_EVENT` (line 49), reachable only via the SLA breach → escalation chain (Story 17), never via a direct Ticketing HTTP call. This story's new escalated-history e2e coverage must emit the event directly on a resolved `EventEmitter2`, not through an HTTP PATCH.
5. `apps/api/test/ticket-escalation-notification.e2e-spec.ts` lines 66–104 (read in full) — the exact precedent for building a real `TicketEscalatedEvent` from a real created ticket's HTTP response and emitting it directly (`eventEmitter.emit(TICKET_ESCALATED_EVENT, event)`), plus lines 88–104's `waitForNotificationLogRows` polling-helper shape (poll until a row appears, with a timeout, rather than asserting immediately). This story's new escalated-history test reuses this same emit-then-poll shape, polling `GET /tickets/:id/history` instead of `NotificationLog`.
6. `apps/api/src/modules/tickets/tickets.module.ts` (21 lines, read in full) — `TicketHistoryListener` is already registered as a provider (line 18, inside `providers: [TicketsService, TenantContext, TicketHistoryListener, TicketEscalationListener]`). No module change is needed; `@OnEvent` handlers are auto-discovered once the class is instantiated as a provider (module's own doc comment, lines 8–15).
7. `apps/api/src/modules/tickets/ticket-history.listener.spec.ts` (82 lines, read in full) — the exact hand-built-mock unit-test precedent this story's two new test blocks follow: `buildPrismaMock()`/`createListener()` helpers (lines 7–17), one `describe` block per handler (`onTicketCreated` lines 41–60, `onTicketUpdated` lines 62–81), each with a "persists a history row with..." test and a "does not throw when persistence fails" test.
8. `apps/api/test/tickets.e2e-spec.ts` lines 41–77 (read in full) — describe-scoped state declarations (`app`, `adminAccessToken`, `adminUserId`, `customerId`, `ticketId`, `createdEvents`, `updatedEvents` — lines 42–50) and `beforeAll` setup. `EventEmitter2` is currently resolved as a **local `const eventEmitter`** inside `beforeAll` (line 64) solely to register `.on("ticket.created", ...)`/`.on("ticket.updated", ...)` listeners (lines 65–66) — it is **not** exposed to any `it()` block. This story must hoist it to describe scope (Task 4) so the new escalated-history test can call `eventEmitter.emit(...)` directly.
9. `apps/api/test/tickets.e2e-spec.ts` lines 155–247 (read in full) — the existing ticket-creation test sets no explicit priority, defaulting to `"MEDIUM"` (asserted at line 165). The existing **"updates status and priority"** test (lines 209–233) then `PATCH`es `{ status: "IN_PROGRESS", priority: "HIGH" }` — a `priority` change, which (per Context item 3) **also** triggers `TICKET_RECATEGORIZED_EVENT` for this exact call, even though the test's name and current assertions only address `ticket.updated`. The immediately-following **"records a second, ticket.updated history entry..."** test (lines 235–247) asserts `expect(response.body).toHaveLength(2)`. After this story's listener change, this same PATCH will produce **three** history rows (`ticket.created`, `ticket.updated`, `ticket.recategorized`), and this existing assertion will fail unless updated — this is a required fix, not new coverage (Task 5).
10. [`ticketing` Story 09's plan](../ticketing/09-story-ticket-history-timeline.md) — the original `TicketHistoryListener` design (catch-and-log, `record()` helper, one `@OnEvent` per event) this story extends unchanged in shape.
11. `apps/api/prisma/schema.prisma` lines 292–305 (`TicketHistoryEntry`, read in full) — `eventType String` (line 298, no enum, no `CHECK` constraint) and `snapshot Json` (line 299). Confirms no migration is needed: any new string `eventType` value is already storable without a schema change.

---

## Implementation Tasks

### 1 — Widen `TicketHistoryListener` to subscribe to `ticket.recategorized` and `ticket.escalated`

File: `apps/api/src/modules/tickets/ticket-history.listener.ts`

Change the import (current lines 1–6) to also import the two new event constants/types:

```typescript
import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  TICKET_CREATED_EVENT,
  TICKET_UPDATED_EVENT,
  TICKET_RECATEGORIZED_EVENT,
  TICKET_ESCALATED_EVENT,
} from "./tickets.events";
import type {
  TicketCreatedEvent,
  TicketUpdatedEvent,
  TicketRecategorizedEvent,
  TicketEscalatedEvent,
} from "./tickets.events";
```

Update the class doc comment (current lines 8–15) to state it now covers all four Ticketing events, e.g. replacing "The first real subscriber to the events `TicketsService` emits (Story 08)" with wording that also names `ticket.recategorized` (Story 16, emitted by `TicketsService`) and `ticket.escalated` (Story 17, emitted by `TicketEscalationListener`, not `TicketsService` directly) as covered.

Add two new handlers immediately after the existing `onTicketUpdated` (current lines 27–30):

```typescript
  @OnEvent(TICKET_RECATEGORIZED_EVENT)
  async onTicketRecategorized(event: TicketRecategorizedEvent): Promise<void> {
    await this.record(TICKET_RECATEGORIZED_EVENT, event);
  }

  @OnEvent(TICKET_ESCALATED_EVENT)
  async onTicketEscalated(event: TicketEscalatedEvent): Promise<void> {
    await this.record(TICKET_ESCALATED_EVENT, event);
  }
```

Widen `record()`'s parameter union type (current lines 32–35) to accept all four event types:

```typescript
  private async record(
    eventType: string,
    event: TicketCreatedEvent | TicketUpdatedEvent | TicketRecategorizedEvent | TicketEscalatedEvent,
  ): Promise<void> {
```

The body of `record()` (current lines 36–51) is unchanged — it already only reads `event.ticket.id`, `event.actorUserId`, and `event.ticket` (all present, identically shaped, on every one of the four event types).

### 2 — No schema/migration change

`TicketHistoryEntry.eventType` is an unconstrained `String` column (Context item 11) — no Prisma schema edit, no migration.

### 3 — No module change

`apps/api/src/modules/tickets/tickets.module.ts` already registers `TicketHistoryListener` as a provider (Context item 6) — the two new `@OnEvent` handlers are auto-discovered with no import/provider change.

### 4 — Unit tests

File: `apps/api/src/modules/tickets/ticket-history.listener.spec.ts`

Add two new `describe` blocks, `onTicketRecategorized` and `onTicketEscalated`, immediately after the existing `onTicketUpdated` block (current lines 62–81), each mirroring that block's exact structure and using `TICKET_RECATEGORIZED_EVENT`/`TICKET_ESCALATED_EVENT` imported from `./tickets.events` (add to the existing import at line 3):

- `onTicketRecategorized`: "persists a history row with eventType ticket.recategorized" (asserts `prisma.ticketHistoryEntry.create` called with `{ data: { ticketId: "ticket-1", actorUserId: null, eventType: TICKET_RECATEGORIZED_EVENT, snapshot: ticket } }`, reusing the file's existing `ticket` fixture, current lines 19–29); "does not throw when persistence fails — it catches and logs instead".
- `onTicketEscalated`: same two tests, substituting `TICKET_ESCALATED_EVENT`.

### 5 — Hoist `eventEmitter`; add escalated-history e2e coverage

File: `apps/api/test/tickets.e2e-spec.ts`

Add `TICKET_ESCALATED_EVENT`/`TicketEscalatedEvent` to the existing import (current line 9):

```typescript
import {
  TICKET_ESCALATED_EVENT,
} from "../src/modules/tickets/tickets.events";
import type { TicketCreatedEvent, TicketUpdatedEvent, TicketEscalatedEvent } from "../src/modules/tickets/tickets.events";
```

Add a describe-scoped declaration alongside the existing ones (current lines 42–50):

```typescript
  let eventEmitter: EventEmitter2;
```

Change the local `const` at current line 64 to assign the hoisted variable instead of shadowing it:

```typescript
    eventEmitter = moduleRef.get(EventEmitter2);
```

Add a new test after the existing history tests (after current line 247, before line 249's "returns 404 for history on an unknown ticket id" — order does not matter functionally, but keep it adjacent to the other history assertions for readability), following `ticket-escalation-notification.e2e-spec.ts`'s emit-then-poll shape (Context item 5):

```typescript
  it("records a ticket.escalated history entry for a real, directly-emitted event", async () => {
    const ticket = await request(app.getHttpServer())
      .get(`/api/v1/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    const escalatedEvent: TicketEscalatedEvent = { ticket: ticket.body, actorUserId: null };
    eventEmitter.emit(TICKET_ESCALATED_EVENT, escalatedEvent);

    const deadline = Date.now() + 5000;
    let history: Array<{ eventType: string }> = [];
    do {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/tickets/${ticketId}/history`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);
      history = response.body;
      if (history.some((entry) => entry.eventType === TICKET_ESCALATED_EVENT)) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    } while (Date.now() < deadline);

    const escalatedEntry = history.find((entry) => entry.eventType === TICKET_ESCALATED_EVENT);
    expect(escalatedEntry).toBeDefined();
  });
```

### 6 — Fix the existing "updates status and priority" history assertion for the new recategorized row

File: `apps/api/test/tickets.e2e-spec.ts`, current lines 235–247

The existing test currently reads:

```typescript
  it("records a second, ticket.updated history entry after the update, ordered after the first", async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/tickets/${ticketId}/history`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(response.body).toHaveLength(2);
    expect(response.body[0].eventType).toBe("ticket.created");
    expect(response.body[1].eventType).toBe("ticket.updated");
    expect(response.body[1].actorUserId).toBe(adminUserId);
    expect(response.body[1].snapshot.status).toBe("IN_PROGRESS");
    expect(response.body[1].snapshot.priority).toBe("HIGH");
  });
```

Because the preceding PATCH (lines 209–233) changes `priority` from `"MEDIUM"` to `"HIGH"`, `TicketsService.updateTicket` also emits `TICKET_RECATEGORIZED_EVENT` for this same call (Context item 3/9). Replace the test with:

```typescript
  it("records a second and third history entry, ticket.updated then ticket.recategorized, after a priority-changing update", async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/tickets/${ticketId}/history`)
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .expect(200);

    expect(response.body).toHaveLength(3);
    expect(response.body[0].eventType).toBe("ticket.created");
    expect(response.body[1].eventType).toBe("ticket.updated");
    expect(response.body[1].actorUserId).toBe(adminUserId);
    expect(response.body[1].snapshot.status).toBe("IN_PROGRESS");
    expect(response.body[1].snapshot.priority).toBe("HIGH");
    expect(response.body[2].eventType).toBe("ticket.recategorized");
    expect(response.body[2].actorUserId).toBe(adminUserId);
    expect(response.body[2].snapshot.priority).toBe("HIGH");
  });
```

---

## Edge Cases & Failure Modes

- **A recategorizing `PATCH` emits `ticket.updated` then `ticket.recategorized` in the same call** (Context item 3): two history rows are persisted, in that emission order, each independently — enforced by `record()`'s unchanged catch-and-log behavior (`ticket-history.listener.ts` lines 32–52): a persistence failure on one event's row never blocks or is affected by the other's, since each `@OnEvent` handler is invoked and awaited independently by `EventEmitter2`.
- **`ticket.escalated` always carries `actorUserId: null`** (`TicketEscalationListener`, Context item 4, line 49) — `onTicketEscalated` persists this `null` verbatim, identical to how `onTicketUpdated` already handles a `null` actor.
- **Persistence failure for either new event type** is caught and logged at `error` level, never rethrown — identical to the two existing handlers, enforced at the same unchanged `record()` try/catch (`ticket-history.listener.ts` lines 36–51).
- **A ticket recategorized without ever being escalated, or vice versa:** both remain valid, independent histories — no ordering dependency between `ticket.recategorized` and `ticket.escalated` rows is assumed or enforced anywhere in `record()`.
- **Concurrent recategorization/escalation for different tickets:** each event carries its own `event.ticket.id`; `record()` scopes its write per call via that id — no shared state between invocations.

---

## Test Plan

1. **Unit — `apps/api/src/modules/tickets/ticket-history.listener.spec.ts` (extended):** two new `describe` blocks, `onTicketRecategorized` and `onTicketEscalated`, each with a "persists a history row" test and a "does not throw when persistence fails" test (Task 4).
2. **Integration — `apps/api/test/tickets.e2e-spec.ts` (extended):** the existing recategorization-adjacent assertion updated for the new third row (Task 6), plus a new emit-then-poll `ticket.escalated` scenario (Task 5).
3. **Regression:** the full existing `apps/api` unit + e2e suite, in particular the rest of `tickets.e2e-spec.ts`'s order-dependent `describe` block (unaffected by this story except the two named changes) and `ticket-escalation-notification.e2e-spec.ts` (shares the same `TICKET_ESCALATED_EVENT` contract, entirely unmodified by this story).

---

## Migration / Rollback

None. No Prisma schema change, no new column, no new table (Context item 11). Rollback is a plain code revert — no data cleanup of any kind is needed.

---

## Verification Steps

1. **Backend builds:** `pnpm --filter @crm/api typecheck`, `lint`, `build`.
2. **Workspace builds:** `pnpm typecheck`, `pnpm lint`, `pnpm build` at the repository root.
3. **Unit tests:** `pnpm --filter @crm/api test`.
4. **Live infra:** `docker compose up -d postgres redis` (temporary `5433` fallback if the native PostgreSQL service is again occupying `5432` — revert immediately after, exactly as prior stories did).
5. **Integration tests:** `pnpm --filter @crm/api test:e2e`. Run at least twice to confirm no flakiness from the new poll-based escalated-history assertion.
6. **Regression:** confirm the full existing `apps/api` unit + e2e suite is otherwise unaffected, in particular every other `tickets.e2e-spec.ts` scenario and `ticket-escalation-notification.e2e-spec.ts`, and that `apps/worker`'s own suites (untouched by this story) still pass.
7. **Hygiene:** `git status`; confirm `.squad/config.yaml` has an empty diff; confirm `apps/api/prisma/schema.prisma`, `apps/api/src/modules/tickets/tickets.service.ts`, `apps/api/src/modules/tickets/tickets.module.ts`, `apps/api/src/modules/tickets/ticket-escalation.listener.ts`, every SLA-policies file, every Notifications-domain file, `apps/worker/**`, and `apps/api/src/queues/**` all have empty diffs.
8. **CI:** `gh run list --workflow=ci.yml --limit 5` if `gh` is reachable; otherwise report CI verification as explicitly pending — never assumed.

## Done Criteria

- [ ] `TicketHistoryListener` subscribes to all four Ticketing events: `ticket.created`, `ticket.updated`, `ticket.recategorized`, `ticket.escalated`.
- [ ] A recategorizing update (category/priority/departmentId change) produces two new history rows in the correct order (`ticket.updated` then `ticket.recategorized`), verified end-to-end.
- [ ] An escalation produces a history row with `eventType: "ticket.escalated"` and `actorUserId: null`, verified end-to-end.
- [ ] No Prisma schema or migration change.
- [ ] No change to `TicketsService`, `SlaTargetListener`, `TicketEscalationListener`, any Notifications-domain listener, `apps/worker/**`, or `apps/api/src/queues/**`.
- [ ] No new HTTP endpoint, no new module wiring beyond the listener file itself.
- [ ] The one identified pre-existing e2e assertion (`tickets.e2e-spec.ts`, current lines 235–247) is updated to match the new, correct row count and content it now produces — not silently left failing.
- [ ] `.squad/config.yaml` is untouched.
- [ ] Full existing lint/typecheck/build/test suite (every prior story through Story 20) still passes with no regressions.
- [ ] `git status` shows no unrelated changes after implementation.

---

**STOP HERE. Report to the user and wait for confirmation before implementing.**
