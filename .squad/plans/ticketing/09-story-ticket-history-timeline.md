# Story 09 — Ticketing: Ticket History / Timeline

## Prerequisites

- `ticketing` Story 08 completed and committed (`d176b86 feat(ticketing): add domain-event emission for ticket create/update`, see [08-story-ticketing-domain-events-foundation.md](./08-story-ticketing-domain-events-foundation.md)): `TicketsService.createTicket`/`updateTicket` (`apps/api/src/modules/tickets/tickets.service.ts`) already emit `TICKET_CREATED_EVENT`/`TICKET_UPDATED_EVENT` (`apps/api/src/modules/tickets/tickets.events.ts`) strictly after their respective Prisma write succeeds, and `EventEmitterModule.forRoot()` is already registered in `apps/api/src/app.module.ts` (line 24). Story 09 does not change any of that timing or wiring.
- `ticketing` Story 07 completed (see [07-story-ticket-and-assignment-foundation.md](./07-story-ticket-and-assignment-foundation.md)): the `Ticket` model, `TicketsService.findTicketInScope`, and the branch-scoped 404-not-403 convention this story reuses unchanged.
- `customer-management` Story 06 completed (see [../customer-management/06-story-customer-and-contact-foundation.md](../customer-management/06-story-customer-and-contact-foundation.md)): the precedent this story follows for deriving tenancy scope through a parent entity instead of a denormalized `branchId` — `Contact` (in that story's Prisma model) has no `branchId` column at all; it is scoped entirely through its parent `Customer`. `TicketHistoryEntry` follows the identical pattern through its parent `Ticket`.
- `TenantContext.userId` (`apps/api/src/common/tenant/tenant-context.ts`, lines 27–33) already exists, is already injected into `TicketsService` (constructor, line 45), and is populated by `TenantMiddleware` from the same JWT `AuthGuard` already validates for every one of `TicketsController`'s four existing routes (none is `@Public()`). No change to `TenantContext`, `TenantMiddleware`, `AuthGuard`, or `JwtStrategy`.

---

## Story Goal

Give every `Ticket` a real, queryable history: persist one append-only `TicketHistoryEntry` for each `ticket.created`/`ticket.updated` event Story 08 already emits — capturing who performed the action, the event type, and the complete post-write ticket snapshot — and expose it through a minimal, branch-scoped `GET /api/v1/tickets/:id/history` endpoint. This is the first real subscriber to Story 08's events, and it closes the "history/timeline" item `docs/architecture/03-domain-boundaries.md` names as something Ticketing owns.

**Not in scope** (see "Edge Cases & Failure Modes" and the intake's own out-of-scope list for the full reasoning behind each): `ticket.escalated`; any before/after diff or changed-fields computation; no-op-update suppression; Socket.IO or any real-time push; Notifications, SLA, Channels, or Customer Portal access; BullMQ, queues, retries, or idempotency logic; pagination; a new `ticket:history` permission; any change to `admin.audit_logs` or `AuditInterceptor`; any change to `.squad/config.yaml`.

---

## Context — Read These Files First

1. [docs/architecture/03-domain-boundaries.md](../../../docs/architecture/03-domain-boundaries.md) — line 9, the `Ticketing` row: owns "Tickets, categories, priorities, statuses, assignments, history/timeline"; "emits `ticket.created`, `ticket.updated`, and `ticket.escalated`." This is the entire explicit specification for "history/timeline" — no fields or API shape are given elsewhere, which is why this plan designs the model from scratch below.
2. [docs/architecture/05-auth-and-security.md](../../../docs/architecture/05-auth-and-security.md) — lines 15–19, "Audit logging": describes `admin.audit_logs`, a **separate, coarser, cross-cutting** mechanism, not the Ticket-facing timeline this story builds.
3. `apps/api/src/common/audit/audit.interceptor.ts` — read in full (62 lines). Lines 41–58 show the `tap(() => { ... .catch((error) => { this.logger.error(...) }) })` pattern with the comment "Audit logging must never break the request it's observing." Confirms two things: (a) today's global audit mechanism records `entityType: "http_request"` (a hardcoded literal, line 49) and **no `entityId`, no payload/diff** — it does not already satisfy a ticket-facing timeline, so `TicketHistoryEntry` is not duplicating it; (b) its catch-and-log-never-rethrow pattern is the exact precedent `TicketHistoryListener` (Task 3 below) must follow.
4. `apps/api/prisma/schema.prisma` (277 lines) — lines 66–80 (`User` model, where the new `ticketHistoryEntries TicketHistoryEntry[]` back-relation field is added); lines 207–222 (`Contact` model — has no `branchId` column, the exact precedent Decision 4 below follows); lines 162–175 (`AuditLog` model — append-only, no `updatedAt`, the exact shape `TicketHistoryEntry` mirrors); lines 252–276 (`Ticket` model, where the new `historyEntries TicketHistoryEntry[]` back-relation field is added, and after which the new `TicketHistoryEntry` model is appended in the `ticketing` schema section).
5. `apps/api/src/modules/tickets/tickets.events.ts` — whole file (14 lines). `TICKET_CREATED_EVENT`/`TICKET_UPDATED_EVENT` constants and `TicketCreatedEvent`/`TicketUpdatedEvent`, each currently `{ ticket: TicketSummary }` only — this is what Task 1 extends.
6. `apps/api/src/modules/tickets/tickets.service.ts` — lines 42–91 (`createTicket`; the emit call is at line 89, immediately after `const summary = toTicketSummary(ticket);` at line 88); lines 107–131 (`updateTicket`; the emit call is at line 127, using `updated` captured at line 115); lines 137–154 (`findTicketInScope`, reused verbatim by the new history read method).
7. `apps/api/src/modules/tickets/tickets.controller.ts` — whole file (39 lines). Four existing routes, none `@Public()`, each using `@RequirePermissions(...)` — the exact pattern the new `GET :id/history` route follows.
8. `apps/api/src/modules/tickets/tickets.module.ts` — whole file (18 lines). `providers: [TicketsService, TenantContext]` — where the new `TicketHistoryListener` is added.
9. `apps/api/src/modules/tickets/tickets.service.spec.ts` — whole file (326 lines). The hand-built-mock pattern (`buildPrismaMock`, `buildTenantContextMock`, `buildEventEmitterMock`, `createService`) this story's new tests copy.
10. `apps/api/test/tickets.e2e-spec.ts` — whole file (322 lines). The existing `beforeAll` bootstrap and the Agent-role-fixture pattern (creating a zero-permission user via the real API) this story's new e2e scenarios reuse verbatim.
11. `apps/api/package.json` — confirms `@nestjs/event-emitter` (added in Story 08) is already a dependency; no new package is needed for `@OnEvent`.

---

## Settled decisions (binding for this story — do not re-open)

1. `actorUserId: string | null` is added as a **sibling field of `ticket`** on both `TicketCreatedEvent` and `TicketUpdatedEvent`. It is **never** added to `TicketSummary` — the REST response shape for tickets themselves stays unchanged.
2. `actorUserId` is sourced from `TenantContext.userId`, read inside `TicketsService` at the existing points of emission — no new constructor dependency.
3. `TicketHistoryEntry` belongs to the existing `ticketing` Prisma schema. Fields: `id`, `ticketId`, `actorUserId` (nullable), `eventType` (`String`), `snapshot` (`Json`), `createdAt`. Relations added to `Ticket` and `User`.
4. **No `branchId` on `TicketHistoryEntry`.** Scoping is always derived through the parent `Ticket` — the same pattern `Contact` already uses through its parent `Customer`.
5. `eventType` is a plain `String`, reusing `TICKET_CREATED_EVENT`/`TICKET_UPDATED_EVENT` verbatim. No new Prisma enum.
6. `snapshot` stores `event.ticket` exactly as received — no diff, no changed-fields calculation, no before/after computation.
7. Exactly one `TicketHistoryEntry` row per emitted event.
8. A no-op `PATCH` (all fields omitted) still emits `ticket.updated` today (Story 08's unchanged behavior) and therefore still produces a history row. No suppression/change-detection is introduced.
9. `EventEmitter2.emit()` stays synchronous, exactly as Story 08 left it. No `emitAsync`, no BullMQ, no queue, no retry, no idempotency logic.
10. The listener catches and logs its own persistence failures — mirroring `AuditInterceptor`'s existing pattern — and never lets a failure propagate. **`TicketsService`'s `eventEmitter.emit(...)` calls are not wrapped in `try/catch`** — no change there.
11. New route: `GET /api/v1/tickets/:id/history`, on the existing `TicketsController`, requiring `ticket:read`, resolving the parent ticket through the existing `findTicketInScope`, returning `404` for unknown/out-of-scope tickets, ordered `createdAt` ascending, no pagination, `actorUserId` returned as a bare id (never a resolved user object).
12. No new permission key — `ticket:history` is explicitly not created.
13. `admin.audit_logs` and `AuditInterceptor` are not modified.
14. `.squad/config.yaml` is not modified.

---

## Implementation Tasks

### 1 — Event contract changes

File: `apps/api/src/modules/tickets/tickets.events.ts`

```typescript
import type { TicketSummary } from "./tickets.service";

export const TICKET_CREATED_EVENT = "ticket.created";
export const TICKET_UPDATED_EVENT = "ticket.updated";

/** Emitted once, after `TicketsService.createTicket` successfully persists the row. */
export interface TicketCreatedEvent {
  ticket: TicketSummary;
  actorUserId: string | null;
}

/** Emitted once, after `TicketsService.updateTicket` successfully persists the row. */
export interface TicketUpdatedEvent {
  ticket: TicketSummary;
  actorUserId: string | null;
}
```

### 2 — Emit `actorUserId` from `TicketsService`

File: `apps/api/src/modules/tickets/tickets.service.ts`

Change the `createTicket` emission (currently line 89) to:

```typescript
this.eventEmitter.emit(TICKET_CREATED_EVENT, {
  ticket: summary,
  actorUserId: this.tenantContext.userId,
} satisfies TicketCreatedEvent);
```

Change the `updateTicket` emission (currently lines 127–129) to:

```typescript
this.eventEmitter.emit(TICKET_UPDATED_EVENT, {
  ticket: toTicketSummary(updated),
  actorUserId: this.tenantContext.userId,
} satisfies TicketUpdatedEvent);
```

No other line in either method changes. `this.tenantContext` is already an injected constructor dependency (line 45) — do not add a new constructor parameter for this.

### 3 — Prisma schema: `TicketHistoryEntry`

File: `apps/api/prisma/schema.prisma`

Add a back-relation field to the **existing** `Ticket` model (after `updatedAt`, before the closing `@@index` block, lines 268–273):

```prisma
  historyEntries   TicketHistoryEntry[]
```

Add a back-relation field to the **existing** `User` model (alongside `assignedTickets`, line 74):

```prisma
  ticketHistoryEntries TicketHistoryEntry[]
```

Both are schema-file-only additions — no column, no migration SQL, the same pattern used for every back-relation added in Stories 07–08.

Append the new model to the `ticketing` schema section, after the `Ticket` model (after line 276):

```prisma
/// Append-only history entry for a Ticket's `ticket.created`/`ticket.updated`
/// domain events — see docs/architecture/03-domain-boundaries.md ("Ticketing",
/// "history/timeline"). No `branchId` — scoping is always derived from the
/// parent Ticket, the same way `customers.Contact` has no `branchId` of its
/// own. `snapshot` is the exact `TicketSummary` the emitting event carried —
/// no diff, no changed-fields computation.
model TicketHistoryEntry {
  id          String   @id @default(uuid())
  ticketId    String   @map("ticket_id")
  ticket      Ticket   @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  actorUserId String?  @map("actor_user_id")
  actorUser   User?    @relation(fields: [actorUserId], references: [id])
  eventType   String   @map("event_type")
  snapshot    Json
  createdAt   DateTime @default(now()) @map("created_at")

  @@index([ticketId])
  @@map("ticket_history_entries")
  @@schema("ticketing")
}
```

`onDelete: Cascade` on `ticketId` matches the existing `Contact.customer` relation's cascade behavior. No `onDelete` on `actorUserId`'s relation, matching `Ticket.assignedToUser`'s existing relation (line 263), which also specifies none. No unique constraint — multiple rows per ticket are expected.

Run `pnpm --filter @crm/api prisma:validate` after editing — must pass with no relation errors.

### 4 — History listener

Create file: `apps/api/src/modules/tickets/ticket-history.listener.ts`

```typescript
import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { PrismaService } from "../../prisma/prisma.service";
import { TICKET_CREATED_EVENT, TICKET_UPDATED_EVENT } from "./tickets.events";
import type { TicketCreatedEvent, TicketUpdatedEvent } from "./tickets.events";

/**
 * The first real subscriber to the events `TicketsService` emits (Story 08).
 * Persistence failures are caught and logged here — never rethrown — so a
 * history-write problem can never turn a successful ticket create/update
 * into a failed HTTP response. Mirrors `AuditInterceptor`'s existing
 * catch-and-log pattern (`apps/api/src/common/audit/audit.interceptor.ts`,
 * lines 41–58: "Audit logging must never break the request it's observing").
 */
@Injectable()
export class TicketHistoryListener {
  private readonly logger = new Logger(TicketHistoryListener.name);

  constructor(private readonly prisma: PrismaService) {}

  @OnEvent(TICKET_CREATED_EVENT)
  async onTicketCreated(event: TicketCreatedEvent): Promise<void> {
    await this.record(TICKET_CREATED_EVENT, event);
  }

  @OnEvent(TICKET_UPDATED_EVENT)
  async onTicketUpdated(event: TicketUpdatedEvent): Promise<void> {
    await this.record(TICKET_UPDATED_EVENT, event);
  }

  private async record(
    eventType: string,
    event: TicketCreatedEvent | TicketUpdatedEvent,
  ): Promise<void> {
    try {
      await this.prisma.ticketHistoryEntry.create({
        data: {
          ticketId: event.ticket.id,
          actorUserId: event.actorUserId,
          eventType,
          snapshot: event.ticket,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to persist ${eventType} history entry`, error as Error);
    }
  }
}
```

File: `apps/api/src/modules/tickets/tickets.module.ts` — add `TicketHistoryListener` to `providers` (currently `[TicketsService, TenantContext]`, line 14):

```typescript
providers: [TicketsService, TenantContext, TicketHistoryListener],
```

`@OnEvent` listeners are discovered automatically by `EventEmitterModule` once the class is instantiated as a Nest provider — no other wiring is needed.

### 5 — Read endpoint

File: `apps/api/src/modules/tickets/tickets.service.ts` — add, near `TicketSummary` (after line 21):

```typescript
export interface TicketHistoryEntrySummary {
  id: string;
  eventType: string;
  actorUserId: string | null;
  snapshot: unknown;
  createdAt: Date;
}
```

Add a new method (near `getTicket`, reusing `findTicketInScope`):

```typescript
async getTicketHistory(id: string): Promise<TicketHistoryEntrySummary[]> {
  await this.findTicketInScope(id);
  const entries = await this.prisma.ticketHistoryEntry.findMany({
    where: { ticketId: id },
    orderBy: { createdAt: "asc" },
  });
  return entries.map((entry) => ({
    id: entry.id,
    eventType: entry.eventType,
    actorUserId: entry.actorUserId,
    snapshot: entry.snapshot,
    createdAt: entry.createdAt,
  }));
}
```

File: `apps/api/src/modules/tickets/tickets.controller.ts` — add, after the existing `update` route (line 37):

```typescript
@Get(":id/history")
@RequirePermissions("ticket:read")
getHistory(@Param("id") id: string): Promise<TicketHistoryEntrySummary[]> {
  return this.ticketsService.getTicketHistory(id);
}
```

(Add `TicketHistoryEntrySummary` to the existing `import type { TicketSummary } from "./tickets.service"` line.)

---

## Edge Cases & Failure Modes

- **Ticket write succeeds → event fires → history insert succeeds:** normal path; no observable change to the original request/response.
- **Ticket write fails:** no event fires (Story 08's existing, unchanged behavior at `tickets.service.ts` — the cross-domain `NotFoundException` checks in `createTicket`/`updateTicket` all run before the emit line) → no history row. Nothing new to build here.
- **Ticket write succeeds, but the listener's own `prisma.ticketHistoryEntry.create` fails:** caught inside `TicketHistoryListener.record`'s `try/catch`, logged via `Logger.error`, never rethrown. Because `EventEmitter2.emit()` is synchronous and does not await async listeners, an uncaught rejection inside an `async` `@OnEvent` handler would otherwise surface only as an unhandled promise rejection on a later microtask, well after the original HTTP response has already been sent — the `try/catch` in the listener prevents that outcome entirely, and is required precisely because `TicketsService`'s emission call (per Settled decision 10) is not itself guarded.
- **`GET /tickets/:id/history` on an unknown or out-of-scope ticket id:** `404`, via the existing `findTicketInScope` (`tickets.service.ts` lines 137–154) — never `403`, never distinguishing "doesn't exist" from "exists in another branch," identical to every other lookup in this module.
- **Missing actor identity:** not reachable today, given the current `AuthGuard`/`TenantMiddleware`/`JwtStrategy` wiring (verified in "Prerequisites") — none of `TicketsController`'s routes are `@Public()`, so a request only reaches `TicketsService` after the identical bearer token has already been independently validated by both mechanisms. `actorUserId: null` is stored defensively if this were ever to occur; the listener never throws for a null actor.
- **A no-op `PATCH` (every field omitted):** still triggers `ticket.updated` today (unchanged Story 08 behavior) and therefore still produces exactly one history row — accepted as-is per Settled decision 8, not suppressed.
- **Duplicate/replayed events:** not applicable. `EventEmitter2.emit()` is called exactly once per successful write, synchronously, in-process, with no queue, retry, or redelivery mechanism anywhere in the current architecture.
- **`prisma migrate dev` for the new table half-applies:** purely additive (one new table, two new FKs, one index) — no existing data at risk; fix and re-run, per the precedent in Stories 06–08.

---

## Test Plan

1. **Unit — extend `apps/api/src/modules/tickets/tickets.service.spec.ts`:** extend the existing `createTicket`/`updateTicket` success-path assertions to also check the emitted payload's `actorUserId` matches the mocked `TenantContext.userId`. Add a new `describe("getTicketHistory")`: throws `NotFoundException` for an unknown/out-of-scope ticket id (mock `ticket.findFirst` → `null`); on success, calls `prisma.ticketHistoryEntry.findMany` with `{ where: { ticketId }, orderBy: { createdAt: "asc" } }` and maps the result to `TicketHistoryEntrySummary[]`.
2. **Unit — new file `apps/api/src/modules/tickets/ticket-history.listener.spec.ts`:** hand-built `PrismaService` mock (no `Test.createTestingModule`), matching `tickets.service.spec.ts`'s existing pattern. Cover: `onTicketCreated` calls `prisma.ticketHistoryEntry.create` with `ticketId`/`actorUserId`/`eventType: TICKET_CREATED_EVENT`/`snapshot` matching `event.ticket`; `onTicketUpdated` does the same with `eventType: TICKET_UPDATED_EVENT`; a rejected `prisma.ticketHistoryEntry.create` is caught and does not reject the promise `onTicketCreated`/`onTicketUpdated` returns.
3. **E2E — extend `apps/api/test/tickets.e2e-spec.ts`:**
   1. Create a ticket → `GET /api/v1/tickets/:id/history` → `200`, exactly one entry, `eventType: "ticket.created"`, `actorUserId` equal to the admin's own user id (from the existing `GET /auth/me` call already used elsewhere in this file), `snapshot.id` equal to the ticket's id.
   2. Update that ticket (status/priority) → `GET .../history` again → `200`, now two entries ordered `createdAt` ascending, the second with `eventType: "ticket.updated"` and the post-update `status`/`priority` inside its `snapshot`.
   3. `GET /api/v1/tickets/:id/history` for a random unknown ticket id → `404`.
   4. `GET /api/v1/tickets/:id/history` with no `Authorization` header → `401`.
   5. Agent-role user (zero permissions, reusing the existing agent-fixture creation pattern already in this file) → `403` on the history endpoint.
4. **Regression:** every existing test in `tickets.service.spec.ts` (51 unit tests as of Story 08) and `tickets.e2e-spec.ts` (part of the 36-test e2e suite as of Story 08) must still pass unmodified, aside from the two targeted extensions in item 1 above.

---

## Migration / Rollback

- Purely additive: one new table (`ticketing.ticket_history_entries`), two new foreign keys (`ticket_id` → `ticketing.tickets`, `actor_user_id` → `identity.users`), one index. No `ALTER TABLE` on any existing table — the two back-relation fields on `Ticket`/`User` produce no SQL, per the established pattern from every prior story's back-relations.
- Generate via `pnpm --filter @crm/api exec prisma migrate dev --name add_ticket_history_entries` against the local Docker Postgres container (using the documented temporary `5433:5432` port fallback if the native PostgreSQL 18 service is again occupying `5432`, reverted immediately after — exactly as Stories 06–08 did).
- If the migration fails partway, fix and re-run — there is no existing data in the new table to lose, and no existing table is modified, so there is nothing to roll back beyond re-running the migration.

---

## Verification Steps

1. **Prisma validates:** `pnpm --filter @crm/api prisma:validate` — must pass with the new model, the new enum-free `eventType` field, and both new back-relations.
2. **Backend builds:** `pnpm --filter @crm/api typecheck`, `pnpm --filter @crm/api lint`, `pnpm --filter @crm/api build`.
3. **Workspace builds:** `pnpm typecheck`, `pnpm lint`, `pnpm build` in the repository root — confirm zero regressions in `apps/web`/`apps/portal`/`apps/worker`/`packages/*`.
4. **Unit tests:** `pnpm --filter @crm/api test` — must run and pass the new `ticket-history.listener.spec.ts` and the extended `tickets.service.spec.ts` alongside every existing unit suite.
5. **Live migration + seed:** `docker compose up -d postgres redis`, `pnpm --filter @crm/api exec prisma migrate deploy`, `pnpm --filter @crm/api prisma:seed` (re-run once more to confirm idempotency).
6. **Integration tests:** `pnpm --filter @crm/api test:e2e` — must pass, including the new history scenarios; capture full output as evidence.
7. **Regression:** re-run `pnpm --filter @crm/api test` and `pnpm --filter @crm/api test:e2e` and confirm the existing Identity & Access, Customer Management, and Ticketing suites are unaffected.
8. **Hygiene:** `git status`/`git diff --stat -- .squad/config.yaml` — confirm the latter returns nothing.
9. **CI:** no `.github/workflows/ci.yml` changes needed. Confirm via `gh run list --workflow=ci.yml --limit 5` if `gh` is reachable; otherwise report CI verification as explicitly pending — never assumed.

## Done Criteria

- [ ] `TicketCreatedEvent`/`TicketUpdatedEvent` both carry `actorUserId: string | null` as a sibling of `ticket`; `TicketSummary` is unchanged.
- [ ] `actorUserId` is sourced from `TenantContext.userId` at the existing emission points; no new `TicketsService` constructor dependency is added.
- [ ] `TicketHistoryEntry` exists in the `ticketing` schema with exactly `id`, `ticketId`, `actorUserId` (nullable), `eventType` (`String`), `snapshot` (`Json`), `createdAt`; no `branchId` column.
- [ ] `ticketId` references `Ticket`; `actorUserId` references `User`; `Ticket` and `User` both have the required back-relations.
- [ ] `eventType` is a plain `String` reusing `TICKET_CREATED_EVENT`/`TICKET_UPDATED_EVENT` verbatim; no new Prisma enum was introduced.
- [ ] `snapshot` stores the complete `event.ticket` payload verbatim; no diff or changed-fields computation exists anywhere in this story's code.
- [ ] Exactly one `TicketHistoryEntry` row is persisted per `ticket.created` event and per `ticket.updated` event, including for a no-op `PATCH`.
- [ ] `TicketHistoryListener` subscribes to both events via `@OnEvent`; a persistence failure is caught and logged inside the listener and never propagates to the original Ticket request; `TicketsService`'s `eventEmitter.emit(...)` calls remain unwrapped by any `try/catch`; `EventEmitter2.emit()` remains synchronous.
- [ ] `GET /api/v1/tickets/:id/history` exists on `TicketsController`, requires `ticket:read`, resolves the ticket through `findTicketInScope`, returns `404` for unknown/out-of-scope ids, returns entries ordered `createdAt` ascending, has no pagination, and returns `actorUserId` as a bare id (never a resolved user object).
- [ ] No new permission key (`ticket:history`) was created.
- [ ] `admin.audit_logs` and `AuditInterceptor` are untouched.
- [ ] No Socket.IO, queue, retry, idempotency, Notifications, SLA, Channels, or Customer Portal functionality was introduced.
- [ ] The migration (generated at implementation time) is purely additive.
- [ ] **`.squad/config.yaml` remains completely untouched** — verified via `git diff --stat -- .squad/config.yaml` returning nothing.
- [ ] `prisma:validate`, `typecheck`, `lint`, and `build` all pass, package-level and workspace-wide.
- [ ] All existing unit and e2e tests continue to pass; the new listener unit tests, extended service unit tests, and new e2e history scenarios all pass with real evidence, not assumed.
- [ ] CI is reported honestly — passing only if actually observed, otherwise explicitly reported as pending.

---

**STOP HERE. Report to the user and wait for confirmation before implementing.**
