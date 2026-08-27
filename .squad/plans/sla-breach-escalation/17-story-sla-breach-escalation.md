# Story 17 — SLA Breach Escalation

## Prerequisites

- `sla-timer-detection-foundation` Story 15 completed (commit `16e5b3b`): `sla.breached`/`sla.at_risk` (`apps/api/src/modules/sla-policies/sla-detection.events.ts`), emitted via `EventEmitter2` by `apps/api/src/queues/sla-timer-events-bridge.processor.ts`. Both files are read-only precedent for this story — neither is modified.
- `ticket-recategorization-sla-target-recomputation` Story 16 completed (commit `2492db6`): `SlaTargetListener.onTicketRecategorized` (`apps/api/src/modules/sla-policies/sla-target.listener.ts`) `upsert`s the *same* `SlaTicketTarget.id` on recategorization — the row's primary key never changes, only `responseTargetAt`/`resolutionTargetAt`/`slaPolicyId` do. This story's idempotency key is built directly on that fact (see Design item 2).
- Ticketing's event-ownership convention (`ticket.created`/`ticket.updated`/`ticket.recategorized`, all Story 08/16, `apps/api/src/modules/tickets/tickets.events.ts`): every `ticket.*` constant is defined and emitted only from inside the `tickets` module. This story's `ticket.escalated` follows the identical convention.
- The intake this plan was generated from (`.squad/stories/sla-breach-escalation/sla-breach-escalation/intake.md`) already settles every open design question — see "Design" below, which restates each settled decision alongside its exact code anchor, re-verified against the live repository during this planning pass.

---

## Story Goal

When an `SlaTicketTarget` breaches (`SLA_BREACHED_EVENT`/`sla.breached`, Story 15, unmodified), the SLA & Automation domain durably records that this specific breach transition was escalated, then Ticketing emits `ticket.escalated` — the event `docs/architecture/03-domain-boundaries.md:9` already names as one of Ticketing's own emitted events. `ticket.escalated` means only "the SLA system escalated this ticket because a target was breached" — it never changes `Ticket.priority`, `Ticket.assignedToUserId`, `Ticket.departmentId`, or any other `Ticket` field.

`SLA_AT_RISK_EVENT`/`sla.at_risk` is explicitly **not** reacted to by this story — at-risk remains a separate, not-yet-built, notification-oriented concern.

**Not in scope:** `AutomationRule`, any generic trigger/condition/action engine, any `Ticket` field mutation, notification delivery of any kind, any new HTTP endpoint or `@RequirePermissions` permission, any frontend change, and any modification to `apps/worker/**`, `apps/api/src/queues/**`, `business-hours-calculator.ts`, `SlaTargetListener`'s existing `onTicketCreated`/`onTicketRecategorized` behavior, or `TicketHistoryListener`.

---

## Context — Read These Files First

1. `apps/api/src/modules/sla-policies/sla-detection.events.ts` (17 lines, read in full) — the entire current shape of `sla.breached`/`sla.at_risk`: `SlaDetectionEventBase { ticketId: string; branchId: string; targetType: "response" | "resolution"; targetAt: Date }` (lines 6-11), `SlaBreachedEvent`/`SlaAtRiskEvent` both extend it with no extra fields (lines 14, 17). This story's new `SlaEscalatedEvent` reuses the identical base — no new fields invented.
2. `apps/api/src/modules/sla-policies/sla-target.listener.ts` (full file, 247 lines after Story 16) — the exact provider/constructor/`@OnEvent`/catch-and-log shape every `sla-policies` listener follows (`constructor(private readonly prisma: PrismaService)`, lines 34-35; `@OnEvent(TICKET_CREATED_EVENT)` at line 39). This story's new `SlaEscalationListener` follows the same shape, plus an injected `EventEmitter2` (since, unlike `SlaTargetListener`, it must emit).
3. `apps/api/src/modules/sla-policies/sla-policies.module.ts` (full file, read in full) — `providers: [SlaPoliciesService, SlaTargetsService, BusinessHoursCalendarsService, TenantContext, SlaTargetListener]` — the exact list this story's new listener is appended to. No controller, no export change needed.
4. `apps/api/src/modules/tickets/tickets.events.ts` (32 lines after Story 16, read in full) — `TICKET_UPDATED_EVENT`/`TicketUpdatedEvent` (lines 4, 13-16) and `TICKET_RECATEGORIZED_EVENT`/`TicketRecategorizedEvent` (lines 18-31) are the exact `{ ticket: TicketSummary; actorUserId: string | null }` shape this story's `TicketEscalatedEvent` mirrors.
5. `apps/api/src/modules/tickets/tickets.service.ts` — `toTicketSummary` (currently `function toTicketSummary(...)` at line 219, **not exported**) is the exact field-mapping this story's new Ticketing-side listener needs to build a `TicketSummary` without duplicating logic. `TicketSummary` (lines 11-21) is the target shape. `findTicketInScope`'s `select`-free `prisma.ticket.findFirst` (line 192) and `SlaTargetListener.onTicketCreated`'s `select`-based `prisma.ticket.findUnique` (Context item 2) are the two existing precedents for reading a `Ticket` row by id — this story's new listener uses the `select`-based shape, scoped to exactly `toTicketSummary`'s parameter fields.
6. `apps/api/src/modules/tickets/tickets.module.ts` (full file, read in full) — `providers: [TicketsService, TenantContext, TicketHistoryListener]`, `exports: [TicketsService]` — the exact list this story's new listener is appended to.
7. `apps/api/src/modules/tickets/ticket-history.listener.ts` (53 lines, read in full) — the exact catch-and-log convention (`try { ... } catch (error) { this.logger.error(...); }`, lines 36-51) every listener in this codebase follows, including this story's two new ones.
8. `apps/api/src/modules/sla-policies/business-hours-calendars.service.ts` lines 32, 326-334 — the existing, established `UNIQUE_CONSTRAINT_VIOLATION = "P2002"` / `error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_CONSTRAINT_VIOLATION` convention this story's idempotency check reuses verbatim. Unlike that precedent (which translates the duplicate into a thrown `ConflictException` for an HTTP caller), this story's listener is not HTTP-driven — a duplicate is caught, logged, and swallowed (return without emitting), never thrown.
9. `apps/api/prisma/schema.prisma` — `Ticket` (lines 256-282: `slaTarget SlaTicketTarget?` at line 273 is the exact back-relation precedent this story's `slaEscalations SlaEscalation[]` follows), `SlaTicketTarget` (lines 359-375: `ticketId String @unique @map("ticket_id")` at line 361, `ticket Ticket @relation(fields: [ticketId], references: [id], onDelete: Cascade)` at line 362 — the exact FK shape this story's `SlaEscalation.ticketId`/`.ticket` mirrors).
10. `apps/api/prisma/migrations/20260826123559_add_sla_ticket_targets/migration.sql` (read in full) — the exact shape (one `CREATE TABLE`, one unique index, one FK to `ticketing.tickets` with `ON DELETE CASCADE`) this story's migration is smaller than (no second FK to `sla_policies`, since this story deliberately has no `SlaPolicy`/`SlaTicketTarget` reference — see Design item 4).
11. `apps/api/test/tickets.e2e-spec.ts` lines 64-66 — `moduleRef.get(EventEmitter2)` then `eventEmitter.on("ticket.created", ...)` is the exact pattern this story's new e2e test reuses to prove `ticket.escalated` really fires through a real, compiled `EventEmitter2`.
12. `docs/architecture/03-domain-boundaries.md:9,11,22-23` and `docs/architecture/02-system-architecture-overview.md:18` — the entire architecture text this story implements against (re-verified this session): Ticketing emits `ticket.escalated`; SLA & Automation owns "escalation... rules"; cross-domain communication is `EventEmitter2`-mediated, never one module calling another's internals directly.

---

## Design (resolved during this planning pass, per the intake's explicit settlement)

1. **Trigger:** `SLA_BREACHED_EVENT` only. No code path in this story subscribes to `SLA_AT_RISK_EVENT`.
2. **Idempotency key:** `(ticketId, targetType, targetAt)`, enforced by a real Postgres unique constraint — not `slaTicketTargetId`, because `SlaTicketTarget.id` stays constant across a Story 16 recategorization recompute (Context item 9's own `@unique @map("ticket_id")` — one row per ticket, forever), while `targetAt` is exactly what a recompute changes. Two breaches of the same ticket/targetType with two different `targetAt` values are two genuinely distinct transitions and must produce two rows; two deliveries of the identical `(ticketId, targetType, targetAt)` must produce exactly one.
3. **No FK to `SlaTicketTarget`/`SlaPolicy`:** resolving either would require an extra `SlaTicketTarget` lookup by `ticketId` between breach detection and this reaction — a lookup that can race against `SlaTargetListener.onTicketRecategorized` deleting that exact row when a recategorization no longer matches any policy (Story 16, same file, `deleteMany({ where: { ticketId } })`). `SlaEscalation` carries `ticketId`/`branchId`/`targetType`/`targetAt` directly from the event payload instead — zero extra reads, zero race window.
4. **Two-hop event chain, not a direct cross-module call:** the SLA-side listener never imports `TICKET_ESCALATED_EVENT` or calls `TicketsService`. It persists `SlaEscalation`, then emits a new SLA-owned event, `SLA_ESCALATED_EVENT`/`sla.escalated` (same `SlaDetectionEventBase` shape). A second, new listener living in the `tickets` module subscribes to `sla.escalated` and is the only code in this story that calls `.emit(TICKET_ESCALATED_EVENT, ...)` — matching the unbroken existing convention that every `ticket.*` event is emitted only from inside the `tickets` module, and adding zero new NestJS module import edges (`TicketsModule` does not import `SlaPoliciesModule` or vice versa; both listeners communicate only through the already-global `EventEmitter2`).
5. **Duplicate detection:** `prisma.slaEscalation.create(...)`; a `Prisma.PrismaClientKnownRequestError` with `code === "P2002"` means this exact transition was already escalated — caught, logged at `log` level (not `error` — it is not a failure), and the method returns without emitting `sla.escalated`. Any other error is caught, logged at `error` level, and also returns without emitting — never rethrown (Context item 7's convention).
6. **`ticket.escalated` payload:** `{ ticket: TicketSummary; actorUserId: null }` — identical shape to `TicketUpdatedEvent`/`TicketRecategorizedEvent`, `actorUserId` always `null` because no human actor is involved in a system-triggered escalation.
7. **Append-only:** `SlaEscalation` rows are never updated after creation, matching `TicketHistoryEntry`'s existing convention (Context item 7's file).

---

## Implementation Tasks

### 1 — Schema: `SlaEscalation`

File: `apps/api/prisma/schema.prisma`

Insert after the `SlaTicketTarget` model's closing brace (current line 375), before the `BusinessHoursCalendar` doc comment (current line 377):

```prisma
/// Story 17 — the persisted record of one escalated SLA breach transition.
/// Identity is (ticketId, targetType, targetAt), not slaTicketTargetId:
/// SlaTicketTarget.id stays constant across a Story 16 recategorization
/// recompute (only its target timestamps/slaPolicyId change), so targetAt is
/// what actually distinguishes "breach under the old target" from "breach
/// under the recomputed one" — the two must produce two separate rows here,
/// not one. Append-only: never updated after creation, mirroring
/// TicketHistoryEntry's own convention. Deliberately has no FK to
/// SlaTicketTarget/SlaPolicy — resolving one would require an extra lookup
/// that can race against SlaTargetListener.onTicketRecategorized deleting
/// that exact row when a recategorization no longer matches any policy.
model SlaEscalation {
  id          String   @id @default(uuid())
  ticketId    String   @map("ticket_id")
  ticket      Ticket   @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  branchId    String   @map("branch_id")
  targetType  String   @map("target_type")
  targetAt    DateTime @map("target_at")
  escalatedAt DateTime @default(now()) @map("escalated_at")

  @@unique([ticketId, targetType, targetAt])
  @@map("sla_escalations")
  @@schema("sla")
}
```

Add the back-relation to `Ticket` (current line 273, immediately after `slaTarget SlaTicketTarget?`):

```prisma
  slaEscalations   SlaEscalation[]
```

Run `pnpm --filter @crm/api prisma:validate`, then generate the migration (Task 6) before writing any code that depends on the new model's generated TypeScript types.

### 2 — SLA-owned event addition

File: `apps/api/src/modules/sla-policies/sla-detection.events.ts`

Add, after the existing `SlaBreachedEvent` interface:

```typescript
/** Emitted once an `sla.breached` transition has been durably persisted as an `SlaEscalation`. */
export const SLA_ESCALATED_EVENT = "sla.escalated";

export interface SlaEscalatedEvent extends SlaDetectionEventBase {}
```

### 3 — Ticketing-owned event addition

File: `apps/api/src/modules/tickets/tickets.events.ts`

Add, after the existing `TicketRecategorizedEvent` interface:

```typescript
export const TICKET_ESCALATED_EVENT = "ticket.escalated";

/**
 * Emitted once, after the SLA & Automation domain's `sla.escalated`
 * reaction (Story 17) is translated into a Ticketing-owned event by
 * `TicketEscalationListener`. `actorUserId` is always `null` — no human
 * actor is involved in a system-triggered escalation. Does not imply any
 * `Ticket` field changed: priority, assignment, and department are
 * untouched by this event.
 */
export interface TicketEscalatedEvent {
  ticket: TicketSummary;
  actorUserId: string | null;
}
```

### 4 — Export `toTicketSummary`

File: `apps/api/src/modules/tickets/tickets.service.ts`

Change (current line 219):

```typescript
function toTicketSummary(ticket: {
```

to:

```typescript
export function toTicketSummary(ticket: {
```

No other change to this file. `TicketsService`'s own internal calls to `toTicketSummary` are unaffected by adding `export`.

### 5 — `SlaEscalationListener` (`sla-policies` module)

Create file: `apps/api/src/modules/sla-policies/sla-escalation.listener.ts`

```typescript
import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { SLA_BREACHED_EVENT, SLA_ESCALATED_EVENT } from "./sla-detection.events";
import type { SlaBreachedEvent, SlaEscalatedEvent } from "./sla-detection.events";

const UNIQUE_CONSTRAINT_VIOLATION = "P2002";

/**
 * The first real reaction to `sla.breached` (Story 15) — never `sla.at_risk`
 * (Design item 1). Persists one `SlaEscalation` row, keyed on
 * `(ticketId, targetType, targetAt)` — not `slaTicketTargetId`, since that
 * id stays constant across a Story 16 recategorization recompute while
 * `targetAt` is what genuinely changes (Design item 2). On success, emits
 * `sla.escalated` so the `tickets` module — not this one — is the only code
 * that ever emits the Ticketing-owned `ticket.escalated` (Design item 4).
 * Catch-and-log throughout: never rethrows, never turns an unrelated
 * request into a failure.
 */
@Injectable()
export class SlaEscalationListener {
  private readonly logger = new Logger(SlaEscalationListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(SLA_BREACHED_EVENT)
  async onSlaBreached(event: SlaBreachedEvent): Promise<void> {
    try {
      await this.prisma.slaEscalation.create({
        data: {
          ticketId: event.ticketId,
          branchId: event.branchId,
          targetType: event.targetType,
          targetAt: event.targetAt,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_CONSTRAINT_VIOLATION
      ) {
        this.logger.log(
          `Ticket ${event.ticketId} already escalated for ${event.targetType} target at ${event.targetAt.toISOString()}`,
        );
        return;
      }
      this.logger.error("Failed to persist SlaEscalation for sla.breached", error as Error);
      return;
    }

    this.eventEmitter.emit(SLA_ESCALATED_EVENT, {
      ticketId: event.ticketId,
      branchId: event.branchId,
      targetType: event.targetType,
      targetAt: event.targetAt,
    } satisfies SlaEscalatedEvent);
  }
}
```

### 6 — `TicketEscalationListener` (`tickets` module)

Create file: `apps/api/src/modules/tickets/ticket-escalation.listener.ts`

```typescript
import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { PrismaService } from "../../prisma/prisma.service";
import { SLA_ESCALATED_EVENT } from "../sla-policies/sla-detection.events";
import type { SlaEscalatedEvent } from "../sla-policies/sla-detection.events";
import { TICKET_ESCALATED_EVENT, toTicketSummary } from "./tickets.events";
import type { TicketEscalatedEvent } from "./tickets.events";

/**
 * The only code in this story that emits `ticket.escalated` — Ticketing's
 * own event, per docs/architecture/03-domain-boundaries.md:9 (Design item
 * 4). Reacts to the SLA & Automation domain's `sla.escalated`, never reads
 * or writes anything outside this module's own `Ticket` table. Re-fetches
 * by `event.ticketId` rather than trusting any client-supplied data — the
 * same re-fetch-by-id convention `SlaTargetListener` already uses, just in
 * the opposite module direction. Catch-and-log throughout.
 */
@Injectable()
export class TicketEscalationListener {
  private readonly logger = new Logger(TicketEscalationListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(SLA_ESCALATED_EVENT)
  async onSlaEscalated(event: SlaEscalatedEvent): Promise<void> {
    try {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: event.ticketId },
        select: {
          id: true,
          subject: true,
          category: true,
          priority: true,
          status: true,
          customerId: true,
          contactId: true,
          departmentId: true,
          assignedToUserId: true,
        },
      });
      if (!ticket) {
        return;
      }

      this.eventEmitter.emit(TICKET_ESCALATED_EVENT, {
        ticket: toTicketSummary(ticket),
        actorUserId: null,
      } satisfies TicketEscalatedEvent);
    } catch (error) {
      this.logger.error("Failed to emit ticket.escalated for sla.escalated", error as Error);
    }
  }
}
```

**Note for the executor:** `toTicketSummary` is defined and exported in `tickets.service.ts` (Task 4), not `tickets.events.ts` — the `import { TICKET_ESCALATED_EVENT, toTicketSummary } from "./tickets.events"` line above is written for readability but must actually be two import statements, one from `./tickets.events` (`TICKET_ESCALATED_EVENT`, `type TicketEscalatedEvent`) and one from `./tickets.service` (`toTicketSummary`). Use:

```typescript
import { TICKET_ESCALATED_EVENT } from "./tickets.events";
import type { TicketEscalatedEvent } from "./tickets.events";
import { toTicketSummary } from "./tickets.service";
```

### 7 — Register both listeners

File: `apps/api/src/modules/sla-policies/sla-policies.module.ts`

Add `SlaEscalationListener` to the `import` list and to `providers` (after `SlaTargetListener`):

```typescript
import { SlaEscalationListener } from "./sla-escalation.listener";
```

```typescript
  providers: [
    SlaPoliciesService,
    SlaTargetsService,
    BusinessHoursCalendarsService,
    TenantContext,
    SlaTargetListener,
    SlaEscalationListener,
  ],
```

No change to `controllers`/`exports`.

File: `apps/api/src/modules/tickets/tickets.module.ts`

Add `TicketEscalationListener` to the `import` list and to `providers` (after `TicketHistoryListener`):

```typescript
import { TicketEscalationListener } from "./ticket-escalation.listener";
```

```typescript
  providers: [TicketsService, TenantContext, TicketHistoryListener, TicketEscalationListener],
```

No change to `controllers`/`exports`. `AppModule` is unmodified — both `TicketsModule` and `SlaPoliciesModule` are already imported there; only their own provider lists change.

### 8 — Migration

With Docker Postgres up (use the documented temporary `5433:5432` fallback if the native PostgreSQL service is again occupying `5432` — revert immediately after, exactly as prior stories did), run:

```bash
pnpm --filter @crm/api exec prisma migrate dev --name add_sla_escalations
```

Must generate exactly one migration: one `CREATE TABLE "sla"."sla_escalations"`, one unique index on `(ticket_id, target_type, target_at)`, one FK to `ticketing.tickets` with `ON DELETE CASCADE` — the same shape as `20260826123559_add_sla_ticket_targets/migration.sql` minus its second FK (this story has no `sla_policy_id`, per Design item 3). Read the generated `migration.sql` before trusting it.

---

## Edge Cases & Failure Modes

- **The identical `(ticketId, targetType, targetAt)` transition is delivered twice** (e.g., `EventEmitter2.emit()` firing twice for the same transition — the exact rare case Story 15's own edge cases documented for its hand-back queue): the second `create` hits the unique constraint, is caught, logged at `log` level, and no second `sla.escalated`/`ticket.escalated` fires. Enforced in `SlaEscalationListener.onSlaBreached` (Task 5).
- **A ticket is recategorized (Story 16) and later breaches again under the recomputed target:** `targetAt` differs from the original breach's `targetAt`, so this is correctly treated as a new, independent transition — a second `SlaEscalation` row is created and a second `ticket.escalated` fires. Enforced by the composite unique key (Task 1) including `targetAt`, not `slaTicketTargetId`.
- **A ticket is recategorized into a non-matching policy (Story 16 deletes its `SlaTicketTarget`) between the original breach and this story's reaction processing it:** irrelevant to this story — `SlaEscalationListener` never reads `SlaTicketTarget` (Design item 3), so there is nothing to race against; it persists purely from the event payload.
- **`SLA_AT_RISK_EVENT` fires:** no handler in this story subscribes to it; nothing happens (Design item 1).
- **`SlaEscalation.create` fails for a reason other than the unique constraint** (e.g., a transient DB error): caught, logged at `error` level, no emission — the ticket remains correctly eligible for escalation on the next delivery of that same or a later transition, since no partial state was left behind. Enforced in `SlaEscalationListener.onSlaBreached`.
- **The ticket can no longer be found when `TicketEscalationListener` reacts to `sla.escalated`** (a genuinely defensive/unlikely case, since `Ticket` rows are never hard-deleted anywhere in this codebase today): returns without emitting, mirroring `SlaTargetListener.onTicketCreated`'s existing "does nothing when the ticket cannot be re-fetched" behavior. Enforced in `TicketEscalationListener.onSlaEscalated`.
- **`ticket.escalated` emission itself throws** (defensive — `EventEmitter2.emit` is synchronous dispatch and does not itself throw for a well-formed payload, but any listener-side computation error is still caught): caught and logged in `TicketEscalationListener`; `SlaEscalation` remains correctly persisted regardless (it was already committed before this point) — an accepted, documented gap, not retried, matching Story 15's own "favor a documented rare-failure gap over new delivery machinery" precedent.

---

## Test Plan

1. **Unit — `apps/api/src/modules/sla-policies/sla-escalation.listener.spec.ts` (new):** hand-built `PrismaService`/`EventEmitter2` mocks (mirroring `sla-target.listener.spec.ts`'s `buildPrismaMock` pattern). Cover: a first-time breach persists an `SlaEscalation` row with the exact payload fields and then emits `sla.escalated` with the identical `ticketId`/`branchId`/`targetType`/`targetAt`; a mocked `P2002` `Prisma.PrismaClientKnownRequestError` on `create` is caught, does not throw, and `eventEmitter.emit` is not called; a non-`P2002` error is caught, does not throw, and `eventEmitter.emit` is not called; `sla.at_risk` is never subscribed (assert `listener.onSlaAtRisk` — or equivalent — is `undefined`, mirroring `sla-target.listener.spec.ts`'s existing "does not subscribe to ticket.updated" assertion style).
2. **Unit — `apps/api/src/modules/tickets/ticket-escalation.listener.spec.ts` (new):** hand-built `PrismaService`/`EventEmitter2` mocks (mirroring `ticket-history.listener.spec.ts`'s pattern). Cover: re-fetches the ticket by `event.ticketId` with the exact `select` shape from Task 6; emits `ticket.escalated` with `{ ticket: <mapped TicketSummary>, actorUserId: null }` when the ticket is found; does nothing when the ticket cannot be found (no `eventEmitter.emit` call); does not throw when the Prisma read fails — catches and logs instead.
3. **Integration — `apps/api/test/sla-breach-escalation.e2e-spec.ts` (new):** real Postgres + Redis, following `tickets.e2e-spec.ts`'s exact `moduleRef.get(EventEmitter2)` / `eventEmitter.on(...)` pattern (Context item 11) to observe `ticket.escalated` firing for real. Seeds a real `SlaPolicy`/`Ticket` via the existing HTTP API (mirroring `sla-targets.e2e-spec.ts`'s fixture-creation pattern), directly persists (or waits for, if simpler) an `SlaTicketTarget` with `responseTargetAt` already in the past, resolves the real `SlaTimerProcessor`-equivalent trigger path or directly emits `SLA_BREACHED_EVENT` on the resolved `EventEmitter2` to exercise this story's own reaction in isolation from Story 15's 60-second scheduler cadence, and asserts: exactly one `SlaEscalation` row exists for that `(ticketId, targetType, targetAt)`; `ticket.escalated` was observed exactly once with the expected `ticketId`. A second identical emission is then dispatched and asserted to produce no second row and no second `ticket.escalated`.
4. **Regression — no changes, re-run only:** every existing unit spec and every existing `*.e2e-spec.ts` in `apps/api` — confirm nothing else regresses, in particular `sla-target.listener.spec.ts` (Stories 11/13/16 behavior unchanged) and `sla-timers-producer.e2e-spec.ts`/`apps/worker`'s own suites (Story 15 behavior unchanged, this story touches neither).

---

## Migration / Rollback

Additive only: one new table (`sla.sla_escalations`), one new FK to `ticketing.tickets`, one new back-relation field on the existing `Ticket` Prisma model — no existing column, constraint, index, or table is touched. If the migration fails partway, fix and re-run; no existing data is at risk.

---

## Verification Steps

1. **Prisma:** `pnpm --filter @crm/api prisma:validate`.
2. **Backend builds:** `pnpm --filter @crm/api typecheck`, `lint`, `build`.
3. **Workspace builds:** `pnpm typecheck`, `pnpm lint`, `pnpm build` at the repository root.
4. **Unit tests:** `pnpm --filter @crm/api test`.
5. **Live infra:** `docker compose up -d postgres redis` (temporary `5433` fallback if needed, reverted immediately after); `pnpm --filter @crm/api exec prisma migrate dev --name add_sla_escalations`; `pnpm --filter @crm/api prisma:seed` (idempotency check).
6. **Integration tests:** `pnpm --filter @crm/api test:e2e`. Run at least twice to confirm no flakiness from the fire-and-forget event chain.
7. **Regression:** confirm the full existing `apps/api` unit + e2e suite is otherwise unaffected, and that `apps/worker`'s own unit/e2e suites (Story 15, untouched by this story) still pass.
8. **Hygiene:** `git status`; confirm `.squad/config.yaml` has an empty diff; confirm `apps/worker/**`, `apps/api/src/queues/**`, and `apps/api/src/modules/sla-policies/business-hours-calculator.ts` all have empty diffs.
9. **CI:** `gh run list --workflow=ci.yml --limit 5` if `gh` is reachable; otherwise report CI verification as explicitly pending — never assumed.

## Done Criteria

- [ ] A first-time `sla.breached` for a given `(ticketId, targetType, targetAt)` persists exactly one `SlaEscalation` row.
- [ ] A duplicate delivery of the identical transition persists no second row and emits no second `sla.escalated`/`ticket.escalated`.
- [ ] A distinct `targetAt` for the same ticket/targetType (post-Story-16-recategorization) is treated as a new, independent escalation.
- [ ] `sla.at_risk` never causes any `SlaEscalation` row or emission.
- [ ] `sla.escalated` is emitted only from inside the `sla-policies` module; `ticket.escalated` is emitted only from inside the `tickets` module.
- [ ] `ticket.escalated`'s payload is `{ ticket: TicketSummary; actorUserId: null }`.
- [ ] No `Ticket` field (priority, assignment, department, status, category, or any other) is written anywhere in this story's code.
- [ ] No `AutomationRule` model or generic trigger/condition/action evaluation is introduced.
- [ ] No new HTTP endpoint, `@RequirePermissions` permission, or frontend change.
- [ ] `TicketsModule` does not import `SlaPoliciesModule`, and `SlaPoliciesModule` does not import `TicketsModule` — both new listeners communicate only through the existing global `EventEmitter2`.
- [ ] `apps/worker/**`, `apps/api/src/queues/**`, `business-hours-calculator.ts`, `SlaTargetListener`'s existing behavior, and `TicketHistoryListener` are all byte-for-byte unchanged.
- [ ] The migration is additive-only.
- [ ] `.squad/config.yaml` is untouched.
- [ ] Full existing lint/typecheck/build/test suite (Identity & Access, Customer Management, Ticketing, SLA Policy Foundation, Background Job Producer Foundation, SLA Timer Detection Foundation, Ticket Recategorization) still passes with no regressions.

---

**STOP HERE. Report to the user and wait for confirmation before implementing.**
