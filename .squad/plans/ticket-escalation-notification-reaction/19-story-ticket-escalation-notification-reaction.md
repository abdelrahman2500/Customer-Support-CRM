# Story 19 — Ticket Escalation Notification Reaction

## Prerequisites

- `sla-breach-escalation` Story 17 completed (commits `4539740`/`08314c6`): `TICKET_ESCALATED_EVENT`/`TicketEscalatedEvent` (`apps/api/src/modules/tickets/tickets.events.ts`), emitted exactly once by `TicketEscalationListener.onSlaEscalated` (`apps/api/src/modules/tickets/ticket-escalation.listener.ts`). This story does not modify either file — `ticket.escalated` has had **zero consumers** since Story 17 shipped it (verified this session: grepping the whole of `apps/api/src` for `TICKET_ESCALATED_EVENT` returns only its definition and its one emission site).
- `sla-at-risk-notification-reaction` Story 18 completed (commit `cf7fa7c`): the `Notifications` domain (`apps/api/src/modules/notifications/`, `notifications` Postgres schema), `NotificationLog`, and `SlaAtRiskNotificationListener`'s idempotent-`create`-plus-`P2002`-catch pattern — the exact mechanical precedent this story's new listener mirrors. Story 18's own listener, its existing unique constraint, and its existing behavior are **not modified**.
- The intake this plan was generated from (`.squad/stories/ticket-escalation-notification-reaction/ticket-escalation-notification-reaction/intake.md`) explicitly warns against reusing Story 18's SLA-specific idempotency identity unchanged and explicitly forbids this story's new code from reading Ticketing-owned Prisma data directly — both constraints are verified against the real `TicketEscalatedEvent` payload shape below and drive this plan's schema design (Design items 1-3).

---

## Story Goal

Give `ticket.escalated` (Story 17) its first real consumer: the `Notifications` domain records that a ticket escalation occurred, reusing the existing `NotificationLog` model (Story 18) rather than introducing a second table. This is a record-only reaction — no recipient resolution, no template rendering, no delivery, no new domain event, no `Ticket`/`SlaTicketTarget`/`SlaPolicy` mutation.

The central technical fact this story's design turns on: `TicketEscalatedEvent`'s actual payload (verified this session, `tickets.events.ts` lines 43-46) is `{ ticket: TicketSummary; actorUserId: string | null }` — it carries **no** `branchId`, `targetType`, or `targetAt`. Story 18's existing idempotency key, `(eventType, ticketId, targetType, targetAt)`, cannot express uniqueness for a row that has no real value for the last two columns — reusing it unchanged (e.g., by writing `null`/sentinel values into `targetType`/`targetAt`) would not actually enforce anything, since Postgres treats `NULL` as distinct from `NULL` in a unique index. This story therefore extends `NotificationLog` with a second, narrower, independently-scoped unique constraint — see Design items 1-2.

**Not in scope:** full notification delivery (recipients, preferences, templates, channels, providers, retries, delivery status); any new BullMQ queue or `apps/worker` change; `AutomationRule`; any new HTTP endpoint or permission; any frontend change; any `Ticket`/`SlaTicketTarget`/`SlaPolicy` mutation; any change to Story 17's escalation listeners or Story 18's `sla.at_risk` reaction/schema constraint.

---

## Context — Read These Files First

1. `apps/api/src/modules/tickets/tickets.events.ts` (46 lines, read in full) — `TICKET_ESCALATED_EVENT` (line 33) and `TicketEscalatedEvent` (lines 43-46: `{ ticket: TicketSummary; actorUserId: string | null }` — no other fields). `TicketSummary` is defined in `tickets.service.ts` (`id`, `subject`, `category`, `priority`, `status`, `customerId`, `contactId`, `departmentId`, `assignedToUserId` — confirmed no `branchId`). This is the entire payload this story's listener has to work with.
2. `apps/api/src/modules/tickets/ticket-escalation.listener.ts` (57 lines, read in full) — the emitter this story reacts to (line 49, `this.eventEmitter.emit(TICKET_ESCALATED_EVENT, ...)`), inside `onSlaEscalated`, itself only reachable via a successful, uniquely-constrained `SlaEscalation.create()` upstream (Story 17). Not modified by this story.
3. `apps/api/src/modules/notifications/sla-at-risk-notification.listener.ts` (52 lines, read in full) — the exact shape this story's new listener mirrors: `@Injectable()`, `constructor(private readonly prisma: PrismaService)` (no `EventEmitter2` — this story emits no follow-on event either, matching Story 18's own Design item 4 reasoning), `@OnEvent(...)` → `prisma.notificationLog.create(...)` in try/catch, `Prisma.PrismaClientKnownRequestError`/`code === "P2002"` caught and logged at `log` level, any other error caught and logged at `error` level, never rethrown.
4. `apps/api/src/modules/notifications/sla-at-risk-notification.listener.spec.ts` (101 lines, read in full) — the hand-built `PrismaService` mock + `buildUniqueConstraintError()` helper this story's new spec file reuses verbatim.
5. `apps/api/src/modules/notifications/notifications.module.ts` (16 lines, read in full) — `providers: [SlaAtRiskNotificationListener]`; this story's new listener is appended. Its doc comment currently says "The first story in this domain" — update it (Task 4) since this is the second.
6. `apps/api/prisma/schema.prisma` lines 504-514 (`NotificationLog`, read in full) — current shape: `id`, `eventType String`, `ticketId String` (FK to `Ticket`, `onDelete: Cascade`), `branchId String`, `targetType String`, `targetAt DateTime`, `loggedAt DateTime @default(now())`, `@@unique([eventType, ticketId, targetType, targetAt])`. `branchId`/`targetType`/`targetAt` are all **non-nullable today** — this story makes them nullable (Task 1) so a `ticket.escalated` row (which has none of the three) can be written without fabricating values, and adds one new nullable `dedupeKey` column plus one new, additive `@@unique([eventType, dedupeKey])` constraint (Task 2) — Story 18's own existing constraint is left completely unchanged.
7. `apps/api/prisma/migrations/20260826154446_add_sla_target_notification_state/migration.sql` (read in full) — the exact precedent for an additive `ADD COLUMN` migration onto an existing table (four new nullable columns on `SlaTicketTarget`, Story 15). No prior migration in this repository changes an existing column's nullability — this story's `ALTER COLUMN ... DROP NOT NULL` statements (auto-generated by `prisma migrate dev` from the schema edit) are the first of that specific shape, but are a standard, safe, additive-in-effect operation (a `NOT NULL` column widened to nullable never rejects previously-valid data).
8. `apps/api/test/sla-at-risk-notification.e2e-spec.ts` (176 lines, read in full) — the exact e2e pattern (real `AppModule`, `moduleRef.get(PrismaService)` resolved directly since no HTTP endpoint exposes `NotificationLog`, `moduleRef.get(EventEmitter2)` used to emit the event under test directly rather than driving the full upstream chain, polling helper for the persisted row) this story's new e2e suite follows, substituting `TICKET_ESCALATED_EVENT` and asserting on the new `dedupeKey`-based row shape.
9. `docs/architecture/03-domain-boundaries.md` lines 3, 9, 14, 22 — "Modules communicate through domain events or explicit service interfaces exported from the module, never by reaching into another module's Prisma models directly" (line 3); Ticketing "emits `ticket.created`, `ticket.updated`, and `ticket.escalated`" (line 9); Notifications "owns notification routing" (line 14); "A module may read another module's data only through exported service methods... never by importing another module's Prisma model directly" (line 22). This story's intake imposes this rule **more strictly than prior stories' own code does** (see Design item 3) — `SlaTargetListener`/`TicketEscalationListener` both already read `Ticket` directly via the shared `PrismaService` as accepted precedent, but this story's new listener does not do that, by explicit instruction.

---

## Design (resolved during this planning pass, per the intake's explicit delegation)

1. **`branchId`/`targetType`/`targetAt` become nullable on `NotificationLog`.** `TicketEscalatedEvent` has no equivalent data for any of the three (Context item 1). Widening `NOT NULL` → nullable never invalidates existing rows (every row Story 18 has ever written already has non-null values in all three) and requires no backfill.
2. **A second unique constraint, `@@unique([eventType, dedupeKey])`, on a new nullable `dedupeKey` column — Story 18's existing constraint is untouched.** Reusing `(eventType, ticketId, targetType, targetAt)` for `ticket.escalated` rows is impossible: those rows would store `targetType = null`/`targetAt = null`, and Postgres unique indexes never treat two `NULL`s as equal, so that constraint would silently accept unlimited duplicate `ticket.escalated` rows for the same ticket. A blanket `@@unique([eventType, ticketId])` is equally wrong the other way: it would break Story 18 immediately, since a single ticket can legitimately have **two** simultaneous `sla.at_risk` rows (one `targetType: "response"`, one `"resolution"`) sharing the same `eventType`/`ticketId` — that constraint would reject the second as a duplicate. `dedupeKey` is therefore a new, purpose-built nullable column: **left `null` on every SLA row** (so it never participates in any uniqueness decision for them — multiple `NULL`s in that column are never "equal" to Postgres) and **populated with `event.ticket.id` on every `ticket.escalated` row** — giving exactly `(eventType, ticketId)`-equivalent uniqueness for this event type alone, without weakening or altering Story 18's own constraint in any way.
3. **The new listener never queries `Ticket` via Prisma.** This intake's own constraint ("must not... access Ticketing-owned Prisma data directly") is stricter than the read-only-Prisma-access precedent `SlaTargetListener`/`TicketEscalationListener` already established elsewhere in this codebase — this story follows the stricter instruction for its own new code rather than retroactively reconciling prior stories' precedent. Consequence: the persisted row cannot carry `branchId` (not on the event payload, and not fetched) — it is left `null` for `ticket.escalated` rows, an honest reflection of what this listener is actually permitted to know.
4. **No follow-on event.** Identical reasoning to Story 18's own Design item 4: nothing currently needs to react to "a ticket-escalation notification was logged," and inventing one purely for symmetry would be the exact premature infrastructure Stories 15/17/18 already rejected for themselves.
5. **No queue/worker change, no controller.** Identical reasoning to Story 18's Design items 5-6 — there is nothing to enqueue or deliver yet, and no HTTP surface exists for `NotificationLog` at all.
6. **Duplicate detection:** identical mechanism to both existing Notifications-domain and SLA-domain listeners — `prisma.notificationLog.create(...)`; `Prisma.PrismaClientKnownRequestError`/`code === "P2002"` caught, logged at `log` level, method returns; any other error caught, logged at `error` level, returns — never rethrown.

---

## Implementation Tasks

### 1 — Widen `NotificationLog`'s SLA-specific columns to nullable

File: `apps/api/prisma/schema.prisma`

Change (current lines 509-511):

```prisma
  branchId   String   @map("branch_id")
  targetType String   @map("target_type")
  targetAt   DateTime @map("target_at")
```

to:

```prisma
  branchId   String?   @map("branch_id")
  targetType String?   @map("target_type")
  targetAt   DateTime? @map("target_at")
```

### 2 — Add `dedupeKey` and the second unique constraint

File: `apps/api/prisma/schema.prisma`

In the `NotificationLog` model, add a new field immediately after `targetAt` (before `loggedAt`):

```prisma
  dedupeKey  String?   @map("dedupe_key")
```

Add a second `@@unique` line immediately after the existing one (current line 514, `@@unique([eventType, ticketId, targetType, targetAt])`) — do not modify that existing line:

```prisma
  @@unique([eventType, dedupeKey])
```

Update the model's own doc comment (current lines 484-503) to describe the new column/constraint and this story's reason for adding them — following the exact pattern the existing comment already uses to explain the first constraint's reasoning.

Run `pnpm --filter @crm/api prisma:validate`, then generate the migration (Task 6) before writing any code that depends on the updated model's generated TypeScript types.

### 3 — `TicketEscalatedNotificationListener`

Create file: `apps/api/src/modules/notifications/ticket-escalated-notification.listener.ts`

```typescript
import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { TICKET_ESCALATED_EVENT } from "../tickets/tickets.events";
import type { TicketEscalatedEvent } from "../tickets/tickets.events";

const UNIQUE_CONSTRAINT_VIOLATION = "P2002";

/**
 * The second reaction in the `Notifications` domain (after
 * `SlaAtRiskNotificationListener`, Story 18) — the first real consumer of
 * `ticket.escalated` (Story 17). `TicketEscalatedEvent` carries no
 * `branchId`/`targetType`/`targetAt` (unlike the SLA detection events), so
 * this listener never touches those columns and never queries `Ticket` via
 * Prisma — it relies solely on the event payload, per this story's own
 * (stricter than prior stories') "no direct Ticketing Prisma access" rule.
 * Idempotency is `(eventType, dedupeKey)`, with `dedupeKey` set to the
 * ticket id — `NotificationLog`'s existing SLA-specific constraint cannot
 * express this event's identity, since Postgres never treats two `NULL`
 * `targetType`/`targetAt` values as equal (Design item 2). Record-only: no
 * recipient resolution, no template rendering, no delivery, no follow-on
 * event. Catch-and-log throughout: never rethrows.
 */
@Injectable()
export class TicketEscalatedNotificationListener {
  private readonly logger = new Logger(TicketEscalatedNotificationListener.name);

  constructor(private readonly prisma: PrismaService) {}

  @OnEvent(TICKET_ESCALATED_EVENT)
  async onTicketEscalated(event: TicketEscalatedEvent): Promise<void> {
    try {
      await this.prisma.notificationLog.create({
        data: {
          eventType: TICKET_ESCALATED_EVENT,
          ticketId: event.ticket.id,
          dedupeKey: event.ticket.id,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_CONSTRAINT_VIOLATION
      ) {
        this.logger.log(`Ticket ${event.ticket.id} already has a logged escalation notification`);
        return;
      }
      this.logger.error("Failed to persist NotificationLog for ticket.escalated", error as Error);
    }
  }
}
```

### 4 — Register the listener; update `NotificationsModule`'s doc comment

File: `apps/api/src/modules/notifications/notifications.module.ts`

Replace in full:

```typescript
import { Module } from "@nestjs/common";
import { SlaAtRiskNotificationListener } from "./sla-at-risk-notification.listener";
import { TicketEscalatedNotificationListener } from "./ticket-escalated-notification.listener";

/**
 * Owns the `notifications` schema — see
 * docs/architecture/03-domain-boundaries.md ("Notifications"). No
 * controller yet (`NotificationLog` has no HTTP surface, mirroring
 * `SlaEscalation`'s own precedent). `TenantContext` is not provided here —
 * neither listener runs inside request scope; `SlaAtRiskNotificationListener`
 * reads `branchId` from its event payload, `TicketEscalatedNotificationListener`
 * (Story 19) has none available and leaves it `null` (see that file's own
 * doc comment). Neither listener imports `TicketsModule`/`SlaPoliciesModule`
 * — only their event contracts (`tickets.events.ts`/`sla-detection.events.ts`),
 * the same plain-TypeScript-import pattern every existing cross-module
 * listener in this codebase already uses.
 */
@Module({
  providers: [SlaAtRiskNotificationListener, TicketEscalatedNotificationListener],
})
export class NotificationsModule {}
```

### 5 — No change to `AppModule`

`NotificationsModule` is already imported and registered (Story 18) — no change needed.

### 6 — Migration

With Docker Postgres up (use the documented temporary `5433:5432` fallback if the native PostgreSQL service is again occupying `5432` — revert immediately after, exactly as prior stories did), run:

```bash
pnpm --filter @crm/api exec prisma migrate dev --name widen_notification_log_for_ticket_escalation
```

Must generate exactly one migration: three `ALTER TABLE "notifications"."notification_logs" ALTER COLUMN ... DROP NOT NULL` statements (`branch_id`, `target_type`, `target_at`), one `ADD COLUMN "dedupe_key" TEXT`, one new `CREATE UNIQUE INDEX` on `(event_type, dedupe_key)` — no change to the existing unique index on `(event_type, ticket_id, target_type, target_at)`, no change to any other table. Read the generated `migration.sql` before trusting it.

---

## Edge Cases & Failure Modes

- **The identical `ticket.escalated` delivery for the same ticket occurs twice** (a genuinely rare scenario given `ticket.escalated` is only ever emitted once per successful, already-uniquely-constrained upstream `SlaEscalation.create()` — see Context item 2 — but defended against anyway, matching every other listener in this codebase's own "never rely solely on an upstream guarantee" convention): the second `create` hits the `(eventType, dedupeKey)` constraint, is caught, logged at `log` level, no second row. Enforced in `TicketEscalatedNotificationListener.onTicketEscalated` (Task 3).
- **A ticket is escalated more than once over its lifetime** (e.g., a response-target breach escalation followed later by a resolution-target breach escalation, or a post-Story-16-recategorization re-escalation — all legitimate per Story 16/17's own established behavior): `TicketEscalatedEvent`'s payload carries no field that distinguishes one escalation transition from another for the same ticket (Context item 1) — this is an accepted, documented limitation of the current event contract, not something this story invents or can close without changing Story 17's event shape (explicitly out of scope). The second, later escalation's notification-log write is suppressed by the same `(eventType, dedupeKey)` constraint as a true duplicate would be — the ticket already has an on-record escalation notification, and this story does not attempt finer-grained tracking than the event payload supports.
- **`NotificationLog.create` fails for a reason other than the unique constraint:** caught, logged at `error` level, no row persisted — the ticket remains correctly eligible for logging on the next delivery.
- **Story 18's `sla.at_risk` rows:** unaffected by this story's schema changes — `dedupeKey` stays `null` on every such row (never written by `SlaAtRiskNotificationListener`, unmodified by this story), so the new `(eventType, dedupeKey)` constraint never applies to them, and the existing `(eventType, ticketId, targetType, targetAt)` constraint is untouched.
- **A ticket is hard-deleted** (not a real path anywhere in this codebase today, but the schema still declares it): `NotificationLog.ticket`'s existing `onDelete: Cascade` (unmodified) removes rows of both event types along with the ticket.

---

## Test Plan

1. **Unit — `apps/api/src/modules/notifications/ticket-escalated-notification.listener.spec.ts` (new):** hand-built `PrismaService` mock (mirroring `sla-at-risk-notification.listener.spec.ts`'s pattern). Cover: a first-time `ticket.escalated` persists a `NotificationLog` row with `eventType: "ticket.escalated"`, `ticketId`, and `dedupeKey` both equal to the ticket id; a mocked `P2002` `Prisma.PrismaClientKnownRequestError` on `create` is caught and does not throw; a non-`P2002` error is caught and does not throw; the listener does not subscribe to `SLA_AT_RISK_EVENT`/`SLA_BREACHED_EVENT` (assert both are `undefined` on the instance, mirroring `sla-escalation.listener.spec.ts`'s own "does not subscribe to sla.at_risk" assertion style).
2. **Integration — `apps/api/test/ticket-escalation-notification.e2e-spec.ts` (new):** real Postgres + Redis, following `sla-at-risk-notification.e2e-spec.ts`'s exact pattern — `moduleRef.get(PrismaService)` resolved directly (no HTTP endpoint exposes `NotificationLog`), `moduleRef.get(EventEmitter2)` used to emit `TICKET_ESCALATED_EVENT` directly (the intake's own instruction: prove the reaction against a real event, not by driving the full `sla.breached → sla.escalated → ticket.escalated` chain). Creates a real ticket via the HTTP API, builds a `TicketEscalatedEvent`-shaped payload from the created ticket's real id, emits it, polls `prisma.notificationLog.findMany({ where: { eventType: TICKET_ESCALATED_EVENT, dedupeKey: ticketId } })` until exactly one row exists; emits the identical event a second time and confirms no second row after a brief wait.
3. **Regression — no changes, re-run only:** every existing unit spec and every existing `*.e2e-spec.ts` in `apps/api` — confirm nothing else regresses, in particular `sla-at-risk-notification.listener.spec.ts`/`.e2e-spec.ts` (Story 18's `sla.at_risk` rows and their existing constraint are unaffected by the schema widening) and `ticket-escalation.listener.spec.ts`/`sla-breach-escalation.e2e-spec.ts` (Story 17 behavior unchanged) and `apps/worker`'s own suites (untouched by this story).

---

## Migration / Rollback

Additive in effect, though not purely additive in SQL shape: three existing `NotificationLog` columns (`branch_id`, `target_type`, `target_at`) go from `NOT NULL` to nullable — this never rejects any row that already exists (every existing row already has non-null values in all three) and requires no backfill. One new nullable column (`dedupe_key`) and one new unique index are added; the existing unique index on `(event_type, ticket_id, target_type, target_at)` is untouched. No existing table, column value, or constraint besides the three nullability changes is modified. If the migration fails partway, fix and re-run; no existing data is at risk.

---

## Verification Steps

1. **Prisma:** `pnpm --filter @crm/api prisma:validate`.
2. **Backend builds:** `pnpm --filter @crm/api typecheck`, `lint`, `build`.
3. **Workspace builds:** `pnpm typecheck`, `pnpm lint`, `pnpm build` at the repository root.
4. **Unit tests:** `pnpm --filter @crm/api test`.
5. **Live infra:** `docker compose up -d postgres redis` (temporary `5433` fallback if needed, reverted immediately after); `pnpm --filter @crm/api exec prisma migrate dev --name widen_notification_log_for_ticket_escalation`; `pnpm --filter @crm/api prisma:seed` (idempotency check).
6. **Integration tests:** `pnpm --filter @crm/api test:e2e`. Run at least twice to confirm no flakiness from the fire-and-forget event chain.
7. **Regression:** confirm the full existing `apps/api` unit + e2e suite is otherwise unaffected, in particular Story 18's own `sla.at_risk` suites, and that `apps/worker`'s own unit/e2e suites (untouched by this story) still pass.
8. **Hygiene:** `git status`; confirm `.squad/config.yaml` has an empty diff; confirm `apps/worker/**`, `apps/api/src/queues/**`, `apps/api/src/modules/sla-policies/business-hours-calculator.ts`, `apps/api/src/modules/tickets/ticket-escalation.listener.ts`, `apps/api/src/modules/sla-policies/sla-escalation.listener.ts`, and `apps/api/src/modules/notifications/sla-at-risk-notification.listener.ts` all have empty diffs.
9. **CI:** `gh run list --workflow=ci.yml --limit 5` if `gh` is reachable; otherwise report CI verification as explicitly pending — never assumed.

## Done Criteria

- [ ] `NotificationsModule` consumes `TICKET_ESCALATED_EVENT` via a new, dedicated listener.
- [ ] A first-time `ticket.escalated` for a given ticket persists exactly one `NotificationLog` row with `eventType: "ticket.escalated"` and `dedupeKey` equal to the ticket id.
- [ ] A duplicate delivery of the identical event for the same ticket persists no second row.
- [ ] The idempotency key `(eventType, dedupeKey)` is documented in this plan and in the listener's own doc comment.
- [ ] No new notification table is introduced — `NotificationLog` is extended, not duplicated.
- [ ] The listener does not query `Ticket`, `SlaTicketTarget`, or `SlaPolicy` via Prisma, and does not mutate any of them.
- [ ] The listener emits no follow-on domain event.
- [ ] No new HTTP endpoint or permission is introduced.
- [ ] No new BullMQ queue and no `apps/worker` change.
- [ ] `NotificationsModule` does not import `TicketsModule` or `SlaPoliciesModule` — only their event-contract constants/types.
- [ ] Story 17's `ticket.escalated` emission and Story 18's `sla.at_risk` reaction/existing unique constraint are byte-for-byte/behaviorally unchanged.
- [ ] `apps/worker/**`, `apps/api/src/queues/**`, and `business-hours-calculator.ts` are byte-for-byte unchanged.
- [ ] The migration is additive in effect (three columns widened to nullable, one new nullable column, one new unique index; no existing constraint removed or altered).
- [ ] `.squad/config.yaml` is untouched.
- [ ] Full existing lint/typecheck/build/test suite (Identity & Access, Customer Management, Ticketing, SLA Policy Foundation, Background Job Producer Foundation, SLA Timer Detection Foundation, Ticket Recategorization, SLA Breach Escalation, SLA At-Risk Notification Reaction) still passes with no regressions.

---

**STOP HERE. Report to the user and wait for confirmation before implementing.**
