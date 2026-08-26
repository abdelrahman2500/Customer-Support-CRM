# Story 16 — Ticket Recategorization and SLA Target Recomputation

## Prerequisites

- `ticketing` Stories 07–09 completed (commits `a163c8a`/`d176b86`/`3bbb231`): `TicketsService.updateTicket` (`apps/api/src/modules/tickets/tickets.service.ts:118-143`), the `ticket.updated` event contract (`apps/api/src/modules/tickets/tickets.events.ts`), `TicketHistoryListener`'s catch-and-log subscriber pattern (`apps/api/src/modules/tickets/ticket-history.listener.ts`).
- `sla-policy-foundation` Stories 10–13 completed (commits `b0bc708`/`572cae5`/`8bc9cfe`/`4a28551`): `SlaPolicy`, `SlaTicketTarget`, `SlaTargetListener`'s `ticket.created`-only trigger and most-specific-match-wins policy resolution (Story 11), `BusinessHoursCalendar`/`addBusinessMinutes` business-hours-aware computation (Stories 12–13).
- `sla-timer-detection-foundation` Story 15 completed (commit `16e5b3b`): the four fire-once notification-bookkeeping columns on `SlaTicketTarget` (`responseAtRiskNotifiedAt`, `responseBreachedNotifiedAt`, `resolutionAtRiskNotifiedAt`, `resolutionBreachedNotifiedAt`) and the `sla-timers` worker that reads them — unmodified by this story, but this story's recomputation must leave those columns in a state that worker continues to interpret correctly.
- Story 15's own intake explicitly named this story: *"Story 16 remains responsible for `ticket.recategorized` and SLA target recomputation"* (`.squad/stories/sla-timer-detection-foundation/sla-timer-detection-foundation/intake.md:309`). This plan does not reopen any Story 10–15 decision; it only settles the five questions Story 16's own intake explicitly delegated to planning (see "Design" below).

---

## Story Goal

When an existing ticket's SLA-policy-matching classification changes — `category`, `priority`, or `departmentId` — via `PATCH /tickets/:id`:

1. `TicketsService.updateTicket` detects the change and emits a new, dedicated `ticket.recategorized` domain event (in addition to the existing, unconditional `ticket.updated`).
2. `SlaTargetListener` reacts to `ticket.recategorized` by re-resolving the most-specific matching `SlaPolicy` and recomputing `responseTargetAt`/`resolutionTargetAt` — reusing the exact same policy-resolution and business-hours-aware computation Story 11/13 already built, not a second implementation of either.
3. The ticket's single `SlaTicketTarget` row is updated in place (never a second row for the same ticket); if no policy matches after recategorization, the stale target is removed so it can no longer represent an SLA state that no longer applies.
4. Story 15's four fire-once notification columns are reset to `null` whenever the target's policy/deadlines are recomputed, so notification state computed against the *previous* target can never suppress or misrepresent notifications for the *newly computed* target.

**Not in scope:** escalation reactions (Story 17); SLA at-risk/breach detection itself or the `sla-timers` scheduler/cadence (Story 15, unmodified); any change to `BusinessHoursCalendar`'s CRUD surface, schema, or the walk-forward algorithm (Stories 12–13, unmodified); a new SLA policy matching rule; a `Department` CRUD/HTTP surface (none exists in this repository — see Context item 9); CASL/authorization changes; notifications; frontend changes.

---

## Context — Read These Files First

1. `apps/api/src/modules/tickets/tickets.service.ts` (225 lines, read in full) — `updateTicket` (lines 118-143) currently discards the return value of `findTicketInScope(id)` (line 120) even though that method (lines 164-181) already selects `category`/`priority`/`departmentId` — the "before" state this story's change-detection needs is already one call away, not a new query. `TicketSummary` (lines 11-21) and `toTicketSummary` (lines 203-225) are unchanged by this story. `requireDepartmentInScope` (lines 183-190) and `requireUserInScope` (lines 192-200) are the exact precedent this story's new `departmentId`-in-update validation mirrors.
2. `apps/api/src/modules/tickets/tickets.events.ts` (16 lines, read in full) — the exact shape (`export const X_EVENT = "..."` + a payload interface, `{ ticket: TicketSummary; actorUserId: string | null }`) this story's `TICKET_RECATEGORIZED_EVENT`/`TicketRecategorizedEvent` mirrors byte-for-byte, matching `TicketUpdatedEvent` (lines 13-16) exactly — including that `TicketSummary` carries no `branchId`/`createdAt`, which is why every existing listener (and this story's new one) re-fetches those fields server-side by `ticket.id` rather than trusting the event payload for them.
3. `apps/api/src/modules/tickets/dto/update-ticket.dto.ts` (31 lines, read in full) — no `departmentId` field exists today; `apps/api/src/modules/tickets/dto/create-ticket.dto.ts` lines 15-18 is the exact `@IsOptional() @IsUUID()` shape this story adds to `UpdateTicketDto`, matching `assignedToUserId`'s existing shape on both DTOs (optional-assign only, no explicit-null-to-remove semantics — this story does not add removal semantics either).
4. `apps/api/src/modules/tickets/tickets.controller.ts` (44 lines, read in full) — `update()` already binds `UpdateTicketDto` under `@RequirePermissions("ticket:update")`; no controller change is needed beyond the DTO gaining a field.
5. `apps/api/src/modules/tickets/tickets.service.spec.ts` (375 lines, read in full) — the hand-built-`PrismaService`/`TenantContext`/`EventEmitter2`-mock pattern (`buildPrismaMock`/`buildTenantContextMock`/`buildEventEmitterMock`, lines 9-61) this story's new tests extend. The existing `updateTicket` test "only includes fields present in the DTO" (lines 280-305) asserts `prisma.ticket.update` is called with exactly `{ data: { status: "IN_PROGRESS" } }` — this story's changes must keep that assertion passing unmodified (no `departmentId` key appears when the DTO omits it).
6. `apps/api/src/modules/sla-policies/sla-target.listener.ts` (139 lines, read in full) — `onTicketCreated` (lines 37-114) is the two-part pipeline this story's new handler must reuse, not reimplement: policy candidate query + `selectMostSpecificPolicy` (lines 62-71, 124-138) and calendar lookup + `addBusinessMinutes`/wall-clock fallback (lines 76-101). Constructor (lines 31-35) injects only `PrismaService` — no `EventEmitter2`, no HTTP context; this story's handler follows the same shape.
7. `apps/api/src/modules/sla-policies/sla-target.listener.spec.ts` (244 lines, read in full) — `buildPrismaMock` (lines 7-25) is the exact mock shape this story's new `describe("onTicketRecategorized")` block extends (adding `slaTicketTarget.update`/`upsert`/`deleteMany` mocks). The existing test "does not subscribe to ticket.updated" (lines 235-237) asserts `listener.onTicketUpdated` is `undefined` — this story adds `onTicketRecategorized`, a distinctly-named method, so that assertion keeps passing unmodified; `ticket.updated` itself remains unsubscribed by this listener.
8. `apps/api/src/modules/sla-policies/business-hours-calculator.ts` (177 lines) — `addBusinessMinutes(startAt, durationMinutes, timezone, days, exceptions)` (signature at lines 51-57) is called with `ticket.createdAt` as `startAt` by `onTicketCreated` today; this story's recomputation calls the identical function the identical way, with the *newly matched* policy's minute counts, still anchored to the ticket's original `createdAt` (see Design item 5 — recomputation is not "restart the SLA clock").
9. `apps/api/prisma/schema.prisma` — `SlaTicketTarget` (lines 359-375: `ticketId` `@unique`, the four Story 15 notified-at columns, `slaPolicyId` non-nullable) — a recomputation that finds no matching policy cannot merely null out `slaPolicyId`; the row must be deleted instead (Design item 4). `SlaPolicy` (lines 320-338). `Ticket` (lines 256-281: `departmentId` nullable at line 260, `category` nullable at line 269, `priority` non-nullable `TicketPriority` at line 270). No schema change is needed by this story — every column this story reads or writes already exists.
10. `apps/api/prisma/seed.ts` (180 lines) — creates exactly one `Department` ("General", lines 80-85) and no `Department`-creation HTTP endpoint exists anywhere in `apps/api/src/modules` (confirmed via repo-wide search — no controller registers a `department` route). This bounds what the `departmentId`-changed e2e scenario can exercise through the real API alone (see Task 5/Test Plan item 6).
11. `apps/api/test/sla-targets.e2e-spec.ts` (203 lines, read in full) — `waitForSlaTarget` (lines 19-37) is the exact polling helper this story's new e2e suite reuses verbatim (`SlaTargetListener` is fire-and-forget on `ticket.created` today and remains fire-and-forget on `ticket.recategorized`, for the same reason documented at lines 9-17). The "computes a target when a matching, active policy exists" test (lines 122-133) is the fixture-creation pattern (dedicated `SlaPolicy` scoped by a random `category`, via the real `POST /sla-policies` and `POST /tickets` HTTP endpoints) this story's new suite's `beforeAll` follows.
12. `docs/architecture/07-sla-automation-and-ai.md` line 8 — "SLA targets are computed when a ticket is created or recategorized by `SlaModule` reacting to `ticket.created` and `ticket.recategorized`" — the entire architecture text this story implements the second half of. `docs/architecture/03-domain-boundaries.md` line 9 lists Ticketing's emitted events as `ticket.created`, `ticket.updated`, `ticket.escalated` (not `ticket.recategorized`) — a pre-existing gap in that table this story does not need to fix; `ticket.recategorized` is added following the same "domain module owns its own `*.events.ts`" convention `tickets.events.ts` already establishes for the other two.

---

## Design (resolved during this planning pass, per the intake's explicit delegation)

1. **Dedicated event, not derived downstream.** `TicketsService.updateTicket` itself detects the change and emits `TICKET_RECATEGORIZED_EVENT` directly, alongside the existing unconditional `TICKET_UPDATED_EVENT` — not a second listener deriving it from `ticket.updated`'s before/after diff. This is what the intake's description already specifies ("The ticket update flow must detect these changes and emit a dedicated `ticket.recategorized` event") and keeps the change-detection logic in one place, next to the data it needs (the pre-update row `findTicketInScope` already fetched).
2. **Qualifying fields:** exactly `category`, `priority`, `departmentId` — the three fields `SlaTargetListener`'s existing policy-candidate query already matches on (Context item 6). A field only counts as "changed" when present in the DTO (`!== undefined`) **and** different from the existing stored value — an update that resends the same category is not a recategorization.
3. **Event payload:** `{ ticket: TicketSummary; actorUserId: string | null }`, identical in shape to `TicketUpdatedEvent` (Context item 2). `TicketSummary` carries no `branchId`, so — exactly like `onTicketCreated` today — the new listener re-fetches `branchId`/`departmentId`/`category`/`priority`/`createdAt` from Postgres by `event.ticket.id` rather than trusting anything client-supplied in the event. This satisfies the acceptance criterion ("does not trust a client-supplied `branchId`") without inventing a new event-payload shape.
4. **Existing `SlaTicketTarget` row is updated in place; no second lifecycle mechanism.** `ticketId` is `@unique` (Context item 9), so recomputation is a Prisma `upsert` keyed on `ticketId`: `update` when a target already exists (the common case), `create` when the ticket previously had no matching policy and now does. When no policy matches at all after recategorization, the row is deleted (`deleteMany({ where: { ticketId } })`, safe/idempotent whether or not a row exists) — satisfying "no stale previous SLA target remains active" without adding a nullable `slaPolicyId` (which would be a wider schema change than this story's scope justifies).
5. **Recomputation keeps `ticket.createdAt` as the base instant — it does not "restart the SLA clock" from the recategorization moment.** The intake asks this story to reuse "the existing business-hours-aware target computation," which is defined as walking forward from ticket creation (Story 11/13). Recategorization changes *which policy* (and therefore which minute budgets) applies; it does not redefine what "the SLA clock" measures from. A ticket recategorized into a stricter policy long after creation can therefore legitimately compute a `targetAt` already in the past — this is correct, expected behavior, not a bug (see Edge Cases).
6. **Story 15 notification-state lifecycle:** whenever this listener's `upsert` actually writes (create or update), all four notified-at columns are (re)set to `null` unconditionally — never conditionally preserved. Rationale: recategorization can change *what "at risk"/"breached" means* (a different policy's minute counts change the 20%-of-duration at-risk threshold, per Story 15's `evaluateTransition`) even in the rare case the absolute `targetAt` instant happens to land unchanged, so preserving old fire-once state could suppress a notification the new target genuinely requires. This is the one deliberate additional exception to "never mutated" Story 15 already established for these four columns (`schema.prisma:367-370`'s own doc comment) — extended here to also apply on recomputation, not only on first detection.
7. **Safety under a target that was already at-risk/breached:** covered structurally by Design item 6 — the reset always happens as part of the same `upsert` write that changes `slaPolicyId`/`responseTargetAt`/`resolutionTargetAt`, so there is no window where stale notified-at state and a new deadline coexist in the persisted row. The `sla-timers` worker (Story 15) always reads fresh column values on its next 60-second tick; no worker-side change is needed.
8. **Accepted, documented race (not closed by this story):** if a `sla-timers` tick (Story 15) reads/claims a transition on the *old* target in the same narrow window this listener is mid-recomputation, one stale `sla.at_risk`/`sla.breached` event for the pre-recategorization target could already have been enqueued before this listener's `upsert` resets state. Closing this fully would require coordinating with the worker's own claim transaction, which the intake explicitly puts out of scope ("Do not modify... the `sla-timers` scheduler cadence"). Documented in Edge Cases; not solved here, matching Story 15's own "favor documented rare-window gaps over new cross-cutting machinery" precedent (`15-story-...md`'s Edge Cases section, "Enqueue failure after a successful claim").

---

## Implementation Tasks

### 1 — Event contract addition (`apps/api`)

File: `apps/api/src/modules/tickets/tickets.events.ts`

Add, following the file's existing pattern exactly:

```typescript
export const TICKET_RECATEGORIZED_EVENT = "ticket.recategorized";

/**
 * Emitted once, after `TicketsService.updateTicket` successfully persists a
 * change to `category`, `priority`, or `departmentId` — the SLA-policy
 * matching fields. Always accompanied by `TICKET_UPDATED_EVENT` in the same
 * call (this event does not replace it). Payload shape mirrors
 * `TicketUpdatedEvent` exactly — no `branchId`/`createdAt`; subscribers
 * re-fetch those by `ticket.id`.
 */
export interface TicketRecategorizedEvent {
  ticket: TicketSummary;
  actorUserId: string | null;
}
```

### 2 — `UpdateTicketDto` gains `departmentId`

File: `apps/api/src/modules/tickets/dto/update-ticket.dto.ts`

Add, matching `CreateTicketDto`'s `departmentId` field exactly (`create-ticket.dto.ts:15-18`):

```typescript
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  departmentId?: string;
```

### 3 — `TicketsService.updateTicket`: detect recategorization, validate `departmentId`, emit the new event

File: `apps/api/src/modules/tickets/tickets.service.ts`

Add the import:

```typescript
import { TICKET_CREATED_EVENT, TICKET_UPDATED_EVENT, TICKET_RECATEGORIZED_EVENT } from "./tickets.events";
import type { TicketCreatedEvent, TicketUpdatedEvent, TicketRecategorizedEvent } from "./tickets.events";
```

Replace `updateTicket` (current lines 118-143) in full:

```typescript
  async updateTicket(id: string, dto: UpdateTicketDto): Promise<{ id: string }> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const existing = await this.findTicketInScope(id);

    if (dto.departmentId !== undefined) {
      await this.requireDepartmentInScope(dto.departmentId, branchId);
    }
    if (dto.assignedToUserId !== undefined) {
      await this.requireUserInScope(dto.assignedToUserId, branchId);
    }

    const isRecategorized =
      (dto.category !== undefined && dto.category !== existing.category) ||
      (dto.priority !== undefined && dto.priority !== existing.priority) ||
      (dto.departmentId !== undefined && dto.departmentId !== existing.departmentId);

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: {
        ...(dto.subject !== undefined ? { subject: dto.subject } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.departmentId !== undefined ? { departmentId: dto.departmentId } : {}),
        ...(dto.assignedToUserId !== undefined
          ? { assignedToUserId: dto.assignedToUserId }
          : {}),
      },
    });
    const summary = toTicketSummary(updated);
    this.eventEmitter.emit(TICKET_UPDATED_EVENT, {
      ticket: summary,
      actorUserId: this.tenantContext.userId,
    } satisfies TicketUpdatedEvent);
    if (isRecategorized) {
      this.eventEmitter.emit(TICKET_RECATEGORIZED_EVENT, {
        ticket: summary,
        actorUserId: this.tenantContext.userId,
      } satisfies TicketRecategorizedEvent);
    }
    return { id };
  }
```

`findTicketInScope`, `requireDepartmentInScope`, `requireUserInScope`, `toTicketSummary` are unchanged (Context item 1) — this task only changes `updateTicket` itself and the two `import` lines above it.

### 4 — `SlaTargetListener`: extract shared policy-resolution/computation helpers, add `onTicketRecategorized`

File: `apps/api/src/modules/sla-policies/sla-target.listener.ts`

Refactor so `onTicketCreated` and the new `onTicketRecategorized` share the exact same policy-resolution and target-computation code (the intake explicitly forbids a second, parallel implementation of either). Extract two private methods from the body currently inline in `onTicketCreated` (lines 54-101):

```typescript
  private async resolveBestPolicy(ticket: {
    branchId: string;
    departmentId: string | null;
    category: string | null;
    priority: string;
  }): Promise<PolicyCandidate | null> {
    const departmentFilter = ticket.departmentId
      ? { OR: [{ departmentId: null }, { departmentId: ticket.departmentId }] }
      : { departmentId: null };
    const categoryFilter = ticket.category
      ? { OR: [{ category: null }, { category: ticket.category }] }
      : { category: null };
    const priorityFilter = { OR: [{ priority: null }, { priority: ticket.priority }] };

    const candidates = await this.prisma.slaPolicy.findMany({
      where: {
        branchId: ticket.branchId,
        isActive: true,
        AND: [departmentFilter, categoryFilter, priorityFilter],
      },
      orderBy: { createdAt: "asc" },
    });
    return this.selectMostSpecificPolicy(candidates);
  }

  private async computeTargetTimestamps(
    ticket: { branchId: string; createdAt: Date },
    policy: PolicyCandidate,
  ): Promise<[Date, Date]> {
    const calendar = await this.prisma.businessHoursCalendar.findFirst({
      where: { branchId: ticket.branchId },
      include: { branch: { select: { timezone: true } }, days: true, exceptions: true },
    });

    return calendar
      ? [
          addBusinessMinutes(
            ticket.createdAt,
            policy.responseTargetMinutes,
            calendar.branch.timezone,
            calendar.days,
            calendar.exceptions,
          ),
          addBusinessMinutes(
            ticket.createdAt,
            policy.resolutionTargetMinutes,
            calendar.branch.timezone,
            calendar.days,
            calendar.exceptions,
          ),
        ]
      : [
          new Date(ticket.createdAt.getTime() + policy.responseTargetMinutes * MINUTE_MS),
          new Date(ticket.createdAt.getTime() + policy.resolutionTargetMinutes * MINUTE_MS),
        ];
  }
```

Rewrite `onTicketCreated`'s body to call these two helpers instead of the inline logic it has today, keeping its own try/catch, its own `slaTicketTarget.create` call, and its own re-fetch-by-`event.ticket.id` unchanged in substance.

Add the new handler, importing `TICKET_RECATEGORIZED_EVENT`/`TicketRecategorizedEvent` from `../tickets/tickets.events`:

```typescript
  /**
   * The second real subscriber to `TicketsService`'s events — reacts to
   * `ticket.recategorized` only (Design item 1), never `ticket.updated`
   * directly. Reuses `resolveBestPolicy`/`computeTargetTimestamps` verbatim
   * — the same policy-resolution and business-hours computation
   * `onTicketCreated` uses (Design item "reuse, don't reimplement").
   */
  @OnEvent(TICKET_RECATEGORIZED_EVENT)
  async onTicketRecategorized(event: TicketRecategorizedEvent): Promise<void> {
    try {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: event.ticket.id },
        select: {
          branchId: true,
          departmentId: true,
          category: true,
          priority: true,
          createdAt: true,
        },
      });
      if (!ticket) {
        return;
      }

      const bestPolicy = await this.resolveBestPolicy(ticket);
      if (!bestPolicy) {
        // No policy matches the new classification — an existing target
        // would now misrepresent this ticket's SLA state (Design item 4).
        await this.prisma.slaTicketTarget.deleteMany({ where: { ticketId: event.ticket.id } });
        return;
      }

      const [responseTargetAt, resolutionTargetAt] = await this.computeTargetTimestamps(ticket, bestPolicy);

      // Fire-once notification state is reset unconditionally on every
      // recomputed write (Design item 6) — never conditionally preserved.
      await this.prisma.slaTicketTarget.upsert({
        where: { ticketId: event.ticket.id },
        create: {
          ticketId: event.ticket.id,
          slaPolicyId: bestPolicy.id,
          responseTargetAt,
          resolutionTargetAt,
        },
        update: {
          slaPolicyId: bestPolicy.id,
          responseTargetAt,
          resolutionTargetAt,
          responseAtRiskNotifiedAt: null,
          responseBreachedNotifiedAt: null,
          resolutionAtRiskNotifiedAt: null,
          resolutionBreachedNotifiedAt: null,
        },
      });
    } catch (error) {
      this.logger.error("Failed to recompute SLA target for ticket.recategorized", error as Error);
    }
  }
```

No change to `sla-policies.module.ts` — `SlaTargetListener` is already a registered provider (Context confirms `@OnEvent` handlers on an already-provided class are auto-discovered).

### 5 — No Prisma migration

Every column this story reads or writes (`SlaTicketTarget.slaPolicyId`/`responseTargetAt`/`resolutionTargetAt`/the four Story 15 notified-at columns, `Ticket.category`/`priority`/`departmentId`) already exists (Context item 9). This story is behavior-only.

---

## Edge Cases & Failure Modes

- **Update resends the same category/priority/departmentId value:** `isRecategorized` stays `false` (Design item 2's `!==` comparison) — no `ticket.recategorized` event, `SlaTargetListener` is not invoked, existing target/notification state is untouched. Enforced at `tickets.service.ts`'s new `isRecategorized` expression (Task 3).
- **Multiple SLA-matching fields changed in one `PATCH`:** exactly one `ticket.recategorized` event fires (the `||` short-circuits to a single boolean, not one event per changed field) — enforced by the same expression.
- **Only `subject`/`status` change:** no `ticket.recategorized` event — those two fields are not in the `isRecategorized` expression at all, matching the intake's exact field list (Design item 2).
- **Recategorization to a classification no active policy matches:** `resolveBestPolicy` returns `null`; the existing `SlaTicketTarget` row (if any) is deleted via `deleteMany` — safe/idempotent even if none exists. Enforced in `onTicketRecategorized` (Task 4).
- **Ticket previously had no matching policy, recategorization now matches one:** `upsert`'s `create` branch runs — no crash from a missing row, no duplicate-key error (the `ticketId` `@unique` constraint is exactly what `upsert`'s `where` targets).
- **Recomputed `responseTargetAt`/`resolutionTargetAt` land in the past** (a stricter policy matched long after ticket creation — Design item 5): not an error. The next `sla-timers` tick (Story 15, unmodified) evaluates the fresh, non-null-notified-at row exactly the way it already handles "a target already past `targetAt` on the very first tick that ever sees it" (`15-story-...md` Edge Cases) — `evaluateTransition` checks breach before at-risk unconditionally, so it fires `sla.breached` only, never a retroactive `sla.at_risk`.
- **A target had already fired at-risk and/or breach under the previous policy, then recategorization recomputes it:** all four notified-at columns reset to `null` in the same `upsert` write that changes `slaPolicyId`/target timestamps (Design items 6-7) — the worker's next tick evaluates the new deadline with no stale suppression.
- **A `sla-timers` tick races this listener's recomputation** (both touch the same row within the same ~60-second window): documented, accepted gap — Design item 8. Not solved by this story; out of scope per the intake ("Do not modify... the `sla-timers` scheduler cadence").
- **`departmentId` supplied in the `PATCH` body but the department does not belong to the caller's branch:** `requireDepartmentInScope` throws `NotFoundException` before `prisma.ticket.update` or any event emission runs — mirrors `requireUserInScope`'s existing behavior for `assignedToUserId` exactly (Task 3).
- **SLA recomputation persistence fails** (DB error mid-`upsert`/`deleteMany`): caught and logged in `onTicketRecategorized`'s own try/catch — never rethrown, so a recomputation failure can never turn a successful `PATCH /tickets/:id` response into a failed one, mirroring `onTicketCreated`'s and `TicketHistoryListener`'s existing catch-and-log convention.

---

## Test Plan

1. **Unit — `apps/api/src/modules/tickets/tickets.service.spec.ts`** (extend `describe("updateTicket")`):
   - "emits `ticket.recategorized` when `category` changes" — asserts `eventEmitter.emit` called with `TICKET_RECATEGORIZED_EVENT` and the correctly-shaped payload, alongside the existing `TICKET_UPDATED_EVENT` call.
   - "emits `ticket.recategorized` when `priority` changes".
   - "emits `ticket.recategorized` when `departmentId` changes" (mock `prisma.department.findFirst` to resolve, matching the existing `assignedToUserId` reassignment test's shape).
   - "emits `ticket.recategorized` exactly once when `category` and `priority` both change in the same update" — asserts `eventEmitter.emit` called with `TICKET_RECATEGORIZED_EVENT` exactly once (`toHaveBeenCalledTimes`).
   - "does not emit `ticket.recategorized` when only `subject`/`status` change" — extends the existing "only includes fields present in the DTO" test's assertions.
   - "does not emit `ticket.recategorized` when the DTO resends the ticket's current `category`" — `prisma.ticket.findFirst` mock returns a row whose `category` matches the DTO's value.
   - "throws `NotFoundException` when `departmentId` is outside the caller's branch, before updating or emitting" — mirrors the existing "throws NotFoundException when reassigning to a user outside the caller's branch" test (lines 266-278), using `prisma.department.findFirst` instead.
2. **Unit — `apps/api/src/modules/sla-policies/sla-target.listener.spec.ts`** (new `describe("onTicketRecategorized")`, extending `buildPrismaMock` with `slaTicketTarget.upsert`/`deleteMany` mocks):
   - re-fetches the ticket by `event.ticket.id` with the same `select` shape as `onTicketCreated`'s existing test (lines 75-91).
   - does nothing when the ticket cannot be re-fetched (mirrors lines 93-100).
   - recomputes and `upsert`s the target using the newly-matched policy's minute counts, asserting the `update` branch's data includes all four notified-at columns set to `null`.
   - `upsert`'s `create` branch runs (no prior target existed) when a policy now matches.
   - `deleteMany({ where: { ticketId } })` runs, and `upsert` is never called, when no policy matches.
   - reuses the branch's `BusinessHoursCalendar` the same way `onTicketCreated`'s existing calendar test does (mirrors lines 188-217) — proves `computeTargetTimestamps` is genuinely shared, not reimplemented.
   - resets notified-at columns to `null` even when the mocked existing row already has `responseBreachedNotifiedAt`/`resolutionAtRiskNotifiedAt` set (previously at-risk/breached case).
   - does not throw when `slaTicketTarget.upsert` rejects — catches and logs (mirrors lines 178-186).
   - `listener.onTicketRecategorized` is defined and distinct from `onTicketUpdated` (still `undefined` — the existing "does not subscribe to `ticket.updated`" test at lines 235-237 keeps passing unmodified).
3. **Integration — `apps/api/test/ticket-recategorization.e2e-spec.ts`** (new; follows `sla-targets.e2e-spec.ts`'s exact bootstrap/auth pattern, reusing its `waitForSlaTarget` polling approach):
   - creates two dedicated `SlaPolicy` fixtures via `POST /sla-policies`, each scoped by its own random `category` with different `responseTargetMinutes`/`resolutionTargetMinutes`; creates a ticket matching the first via `POST /tickets`; waits for its initial target; `PATCH`es the ticket's `category` to the second policy's category; polls `GET /tickets/:id/sla-target` until `responseTargetAt` changes, then asserts the new value reflects the second policy's minute counts (not the first's) — proving end-to-end recomputation through the real HTTP surface.
   - recategorizes a ticket to a `category` no active policy matches; asserts `GET /tickets/:id/sla-target` returns `404` (target removed).
   - `departmentId`-change coverage: since no `Department`-creation HTTP endpoint exists in this repository (Context item 10), this suite's own `beforeAll` creates a second `Department` row directly via Prisma (a documented, justified exception to the "build fixtures through the real API" convention `tickets.e2e-spec.ts` otherwise follows, made explicit in this file's own doc comment) scoped to the same seeded branch, then exercises `PATCH /tickets/:id` with the new `departmentId` and confirms it is accepted (`200`) and that the ticket's `departmentId` reflects the change via `GET /tickets/:id`.
4. **Regression — no changes, re-run only:** `apps/api/test/tickets.e2e-spec.ts`, `apps/api/test/sla-targets.e2e-spec.ts`, `apps/api/test/sla-policies.e2e-spec.ts`, `apps/api/test/sla-business-hours-target-computation.e2e-spec.ts`, and every existing unit spec in `apps/api` — confirm nothing else regresses, in particular that `tickets.service.spec.ts`'s "only includes fields present in the DTO" assertion (no `departmentId` key when the DTO omits it) still passes unmodified.

---

## Migration / Rollback

No migration. This story adds no schema, no column, no index — purely application-layer behavior over columns that already exist (Task 5). Rollback is a plain code revert; no data-shape change to undo.

---

## Verification Steps

1. **Backend builds:** `pnpm --filter @crm/api typecheck`, `lint`, `build`, run from the repository root.
2. **Workspace builds:** `pnpm typecheck`, `pnpm lint`, `pnpm build`, run from the repository root.
3. **Unit tests:** `pnpm --filter @crm/api test`.
4. **Live infra:** `docker compose up -d postgres redis` (temporary `5433` fallback if the native PostgreSQL service occupies `5432`, reverted immediately after, exactly as prior stories did); `pnpm --filter @crm/api prisma:seed` (idempotency check — no migration to run, per "Migration / Rollback" above).
5. **Integration tests:** `pnpm --filter @crm/api test:e2e`, run at least twice to confirm no flakiness from the new fire-and-forget polling assertions.
6. **Regression:** confirm the existing `tickets.e2e-spec.ts`, `sla-targets.e2e-spec.ts`, `sla-policies.e2e-spec.ts`, and `sla-business-hours-target-computation.e2e-spec.ts` suites are otherwise unaffected, and that Story 15's `apps/worker` unit/e2e suites (unmodified by this story) still pass.
7. **Hygiene:** `git status`; confirm `.squad/config.yaml` has an empty diff; confirm `apps/worker/**`, `apps/api/src/queues/**`, and `apps/api/src/modules/sla-policies/business-hours-calculator.ts` all have empty diffs (this story touches only `tickets.service.ts`, `tickets.events.ts`, `update-ticket.dto.ts`, `sla-target.listener.ts`, and their test files).
8. **CI:** `gh run list --workflow=ci.yml --limit 5` if `gh` is reachable; otherwise report CI verification as explicitly pending — never assumed.

## Done Criteria

- [ ] An update that changes none of `category`/`priority`/`departmentId` does not emit `ticket.recategorized`.
- [ ] Changing `category`, `priority`, or `departmentId` alone each emits exactly one `ticket.recategorized` event.
- [ ] Changing multiple SLA-matching fields in one update still emits exactly one `ticket.recategorized` event.
- [ ] `ticket.recategorized`'s payload carries enough information for recomputation without trusting a client-supplied `branchId` (the listener re-fetches branch/department/category/priority/createdAt server-side by ticket id).
- [ ] `SlaTargetListener` reacts to `ticket.recategorized` via a distinctly-named handler; it still does not subscribe to `ticket.updated`.
- [ ] Policy resolution (most-specific-match-wins, earliest-`createdAt` tie-break) and business-hours-aware computation are reused via shared private methods, not reimplemented.
- [ ] `responseTargetAt`/`resolutionTargetAt` are recomputed and persisted on the ticket's existing `SlaTicketTarget` row when a policy still matches.
- [ ] No stale `SlaTicketTarget` row remains when no policy matches after recategorization (the row is deleted).
- [ ] Repeated recategorization never creates a second `SlaTicketTarget` row for the same ticket (`upsert` keyed on the `ticketId` unique constraint).
- [ ] All four Story 15 notified-at columns reset to `null` on every recomputed write, including when the previous target had already reached at-risk/breached state.
- [ ] `UpdateTicketDto` gains `departmentId`, validated via the existing `requireDepartmentInScope` pattern before any write.
- [ ] `apps/worker`, `apps/api/src/queues/**`, and `business-hours-calculator.ts` are byte-for-byte unchanged.
- [ ] No escalation reaction, escalation job, or escalation workflow is introduced.
- [ ] No Prisma migration is added.
- [ ] `.squad/config.yaml` is untouched.
- [ ] Full existing lint/typecheck/build/test suite (Identity & Access, Customer Management, Ticketing, SLA Policy Foundation, Background Job Producer Foundation, SLA Timer Detection Foundation) still passes with no regressions.

---

**STOP HERE. Report to the user and wait for confirmation before implementing.**
