# Story 18 — SLA At-Risk Notification Reaction

## Prerequisites

- `sla-timer-detection-foundation` Story 15 completed (commit `16e5b3b`): `sla.at_risk`/`SLA_AT_RISK_EVENT` (`apps/api/src/modules/sla-policies/sla-detection.events.ts`), emitted via `EventEmitter2` by `apps/api/src/queues/sla-timer-events-bridge.processor.ts`. Both files are read-only precedent for this story — neither is modified. `sla.at_risk` has had **zero consumers** since Story 15 shipped it (verified this session: grepping the whole of `apps/api/src` for `SLA_AT_RISK_EVENT` returns only its own definition).
- `sla-breach-escalation` Story 17 completed (commits `4539740`/`08314c6`): the exact precedent this story's mechanics mirror — `SlaEscalationListener` (`apps/api/src/modules/sla-policies/sla-escalation.listener.ts`), its idempotent-`create`-plus-`P2002`-catch pattern, and `SlaEscalation`'s schema shape. Story 17's intake explicitly named `sla.at_risk` as "a separate notification-oriented concern for a future story" — this is that story. Story 17's own code is not modified.
- Ticketing's/SLA's event-ownership convention (every `ticket.*`/`sla.*` event constant defined and emitted only from inside its owning module) is preserved; this story introduces no new cross-domain event, only a new domain (`Notifications`) consuming an existing one.
- The intake this plan was generated from (`.squad/stories/sla-at-risk-notification-reaction/sla-at-risk-notification-reaction/intake.md`) explicitly delegates the notification boundary/mechanism/persistence decision to this planning pass — see "Design" below.

---

## Story Goal

Establish the first real consumer of `SLA_AT_RISK_EVENT`/`sla.at_risk` (Story 15): a new `Notifications` domain durably records that a specific SLA target entered its at-risk window, idempotently per transition. This is **not** notification delivery — no recipient resolution, no template rendering, no channel adapter, no `notifications` BullMQ queue. `docs/architecture/06-communication-and-realtime.md:32-34`'s full `NotificationService` design (recipients, preferences, locale-aware templates, per-recipient/channel jobs, delivery logging) remains explicitly out of scope for this story, which only establishes the narrowest first reaction, mirroring the exact trade-off Story 15 and Story 17 already made for their own first slices.

The reaction never touches `Ticket`, `SlaTicketTarget`, or any SLA policy data, never escalates, and never emits or causes `ticket.escalated` — this story's entire footprint is one new domain, one new table, one new listener.

**Not in scope:** `sla.breached` handling (Story 17, unmodified); actual notification delivery (email/SMS/push/in-app) or any provider integration; `AutomationRule` or any generic trigger/condition/action engine; any `Ticket`/`SlaTicketTarget`/`SlaPolicy` field mutation; any new HTTP endpoint or `@RequirePermissions` permission; any frontend change; any modification to `apps/worker/**`, `apps/api/src/queues/**`, `business-hours-calculator.ts`, or Story 17's escalation code.

---

## Context — Read These Files First

1. `apps/api/src/modules/sla-policies/sla-detection.events.ts` (23 lines, read in full) — `SLA_AT_RISK_EVENT` (line 1), `SlaAtRiskEvent` (line 14, extends the unexported `SlaDetectionEventBase`: `ticketId`, `branchId`, `targetType: "response" | "resolution"`, `targetAt: Date`, lines 6-11). This story's listener imports `SLA_AT_RISK_EVENT`/`type SlaAtRiskEvent` — the base interface itself is not exported and is not needed directly.
2. `apps/api/src/modules/sla-policies/sla-escalation.listener.ts` (62 lines, read in full) — the exact pattern this story's new listener mirrors: `@Injectable()` class, `constructor(private readonly prisma: PrismaService)` (no `EventEmitter2` needed here — unlike `SlaEscalationListener`, this story emits no follow-on event, see Design item 4), `@OnEvent(SLA_BREACHED_EVENT)` → `prisma.<model>.create(...)` inside try/catch, `Prisma.PrismaClientKnownRequestError`/`code === "P2002"` caught and logged at `log` level (not `error`), any other error caught and logged at `error` level, never rethrown. This story's `SlaAtRiskNotificationListener` follows the identical shape, subscribed to `SLA_AT_RISK_EVENT` instead.
3. `apps/api/src/modules/sla-policies/sla-escalation.listener.spec.ts` (134 lines, read in full) — the hand-built `PrismaService` mock + `buildUniqueConstraintError()` helper pattern this story's new spec file reuses verbatim for its own `P2002` duplicate-delivery test.
4. `apps/api/src/modules/tickets/tickets.module.ts` and `apps/api/src/modules/sla-policies/sla-policies.module.ts` (both read in full) — the exact `@Module({ providers: [...] })` registration shape a new `NotificationsModule` follows. Neither file is modified by this story.
5. `apps/api/src/app.module.ts` (53 lines, read in full) — `imports: [..., IdentityModule, CustomersModule, TicketsModule, SlaPoliciesModule]` (lines 34-37). **Unlike Story 17** (which needed no `AppModule` change, since both `TicketsModule`/`SlaPoliciesModule` already existed), this story adds a genuinely new module and must add one new import line here — the first `AppModule` change since Story 15/Story 08 registered their own modules.
6. `apps/api/prisma/schema.prisma` — `datasource db` block (lines 15-19): `schemas = ["identity", "admin", "customers", "ticketing", "sla"]` — **`"notifications"` is not present** and must be added (Design item 1). `Ticket` model (lines 256-283: `slaEscalations SlaEscalation[]` at line 274 is the exact back-relation precedent this story's `notificationLogs NotificationLog[]` follows). `SlaEscalation` (lines ~389-400, added by Story 17) is the exact model-shape precedent (flat fields taken directly from the event payload, FK to `Ticket` with `onDelete: Cascade`, composite `@@unique`, no FK to `SlaTicketTarget`/`SlaPolicy`) this story's `NotificationLog` mirrors.
7. `apps/api/prisma/migrations/20260826110531_add_sla_policies/migration.sql` (read in full) — the exact precedent for a migration that introduces a **brand-new logical schema**: its first statement is `CREATE SCHEMA IF NOT EXISTS "sla";`, auto-generated by Prisma from adding a new entry to `datasource.schemas`. This story's migration will auto-generate the equivalent `CREATE SCHEMA IF NOT EXISTS "notifications";` — nothing to hand-write.
8. `apps/api/prisma/migrations/20260827001318_add_sla_escalations/migration.sql` (read in full) — the exact shape (one `CREATE TABLE`, one unique index, one FK to `ticketing.tickets` with `ON DELETE CASCADE`, no other FK) this story's migration matches, in a new schema instead of an existing one.
9. `apps/api/test/sla-breach-escalation.e2e-spec.ts` (205 lines, read in full) — the exact e2e pattern (real `AppModule`, `moduleRef.get(PrismaService)` resolved directly since no HTTP endpoint exposes the new table — the same documented exception this file itself established — `eventEmitter.emit(SLA_BREACHED_EVENT, ...)` dispatched directly to isolate the reaction from Story 15's live scheduler cadence, polling helpers for the persisted row) this story's new e2e suite follows, substituting `SLA_AT_RISK_EVENT` and asserting on `NotificationLog` instead of `SlaEscalation`.
10. `docs/architecture/03-domain-boundaries.md` line 14 ("Notifications | `notifications` | Templates, delivery logs, per-user preferences | Owns notification routing.") and `docs/architecture/06-communication-and-realtime.md` lines 32-34 (`NotificationService` full design) — the entire architecture text this story implements the narrowest possible first slice of; the full `NotificationService` responsibilities (recipients, preferences, templates, per-channel delivery jobs) are explicitly not built here.

---

## Design (resolved during this planning pass, per the intake's explicit delegation)

1. **New domain, not an extension of `sla-policies`.** Architecture assigns "escalation and automation rules" to SLA & Automation (`03:11`) — which is why Story 17 correctly lived in `sla-policies`. It assigns "Templates, delivery logs, per-user preferences... notification routing" to a *separate* `Notifications` domain (`03:14`). This story creates `apps/api/src/modules/notifications/` and the `notifications` Postgres schema rather than bolting a notification concern onto `sla-policies`.
2. **Idempotency key: `(eventType, ticketId, targetType, targetAt)`.** `eventType` (always `"sla.at_risk"` today) is included — not because this story handles more than one event type, but because `NotificationLog` is named and positioned as the Notifications domain's general "delivery logs" home (matching `03:14`'s own vocabulary), the same way `TicketHistoryEntry.eventType` already generalizes across `ticket.created`/`ticket.updated`/`ticket.recategorized` while only two of those were populated when it was first built (Story 08). `ticketId`/`targetType`/`targetAt` reuse Story 17's identical reasoning verbatim: `SlaTicketTarget.id` stays constant across a Story 16 recategorization recompute, so `targetAt` — not the target's row id — is what distinguishes one at-risk transition from the next.
3. **No FK to `SlaTicketTarget`/`SlaPolicy`, only to `Ticket`.** Identical reasoning to Story 17's `SlaEscalation` (Design item 3 of that story): resolving either would need an extra lookup between detection and this reaction, racing against `SlaTargetListener.onTicketRecategorized`'s `deleteMany`. `NotificationLog` persists exactly what the event payload already carries.
4. **No follow-on event is emitted.** Story 17 needed a second hop (`sla.escalated` → `ticket.escalated`) specifically because Ticketing, not SLA, owns `ticket.escalated`'s emission. Nothing analogous exists here: no module currently needs to react to "a notification was logged," and inventing an unconsumed event purely for architectural symmetry would be exactly the premature infrastructure this story's own intake and Story 15/17's precedent both reject. `SlaAtRiskNotificationListener` persists and stops.
5. **No queue/worker change.** Delivery (the actual reason the `notifications` BullMQ queue is named in `06:25`) is not built by this story — there is nothing to enqueue yet. Building the queue now, with no consumer to drain it, would itself be premature infrastructure; the queue is added by whichever future story implements real delivery.
6. **No controller/HTTP endpoint.** Mirrors `SlaEscalation`'s own precedent exactly — no HTTP surface exists for it either. Nothing in this story's acceptance criteria requires reading `NotificationLog` back over HTTP.
7. **Duplicate detection:** identical mechanism to `SlaEscalationListener` — `prisma.notificationLog.create(...)`; a `Prisma.PrismaClientKnownRequestError` with `code === "P2002"` is caught, logged at `log` level (not an error), and the method returns; any other error is caught, logged at `error` level, and also returns — never rethrown.

---

## Implementation Tasks

### 1 — Enable the `notifications` Postgres schema

File: `apps/api/prisma/schema.prisma`

In the `datasource db` block (current lines 15-19), change:

```prisma
  schemas    = ["identity", "admin", "customers", "ticketing", "sla"]
```

to:

```prisma
  schemas    = ["identity", "admin", "customers", "ticketing", "sla", "notifications"]
```

### 2 — Schema: `NotificationLog`

File: `apps/api/prisma/schema.prisma`

Add the back-relation to `Ticket` (current line 274, immediately after `slaEscalations SlaEscalation[]`):

```prisma
  notificationLogs NotificationLog[]
```

Append at the end of the file (after the closing brace of `BusinessHoursException`, currently the last model), a new schema section following the file's existing `// --- <schema> schema ---` divider convention (see current lines 306-308 for the `sla` schema's own divider):

```prisma
// ---------------------------------------------------------------------------
// notifications schema
// ---------------------------------------------------------------------------

/// Story 18 — the Notifications domain's first table (see
/// docs/architecture/03-domain-boundaries.md, "Notifications... Templates,
/// delivery logs, per-user preferences... owns notification routing").
/// Deliberately narrow: this story records only that an `sla.at_risk`
/// transition occurred, not an actual delivered notification — recipient
/// resolution, template rendering, and channel delivery (the full
/// `NotificationService` design in
/// docs/architecture/06-communication-and-realtime.md) are a future story's
/// concern. `eventType` is a plain String (not an enum) so a later event
/// type can populate this same table without a migration, mirroring
/// `TicketHistoryEntry.eventType`'s own precedent — only `"sla.at_risk"` is
/// ever written by this story. Identity for idempotency is
/// (eventType, ticketId, targetType, targetAt), not `slaTicketTargetId`:
/// `SlaTicketTarget.id` stays constant across a Story 16 recategorization
/// recompute, so `targetAt` is what actually distinguishes one at-risk
/// transition from the next (the same reasoning `SlaEscalation`, Story 17,
/// already established). No FK to `SlaTicketTarget`/`SlaPolicy` — resolving
/// one would require an extra lookup that can race against
/// `SlaTargetListener.onTicketRecategorized` deleting that exact row.
/// Append-only: never updated after creation.
model NotificationLog {
  id         String   @id @default(uuid())
  eventType  String   @map("event_type")
  ticketId   String   @map("ticket_id")
  ticket     Ticket   @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  branchId   String   @map("branch_id")
  targetType String   @map("target_type")
  targetAt   DateTime @map("target_at")
  loggedAt   DateTime @default(now()) @map("logged_at")

  @@unique([eventType, ticketId, targetType, targetAt])
  @@map("notification_logs")
  @@schema("notifications")
}
```

Run `pnpm --filter @crm/api prisma:validate`, then generate the migration (Task 5) before writing any code that depends on the new model's generated TypeScript types.

### 3 — `NotificationsModule`

Create file: `apps/api/src/modules/notifications/notifications.module.ts`

```typescript
import { Module } from "@nestjs/common";
import { SlaAtRiskNotificationListener } from "./sla-at-risk-notification.listener";

/**
 * Owns the `notifications` schema — see
 * docs/architecture/03-domain-boundaries.md ("Notifications"). The first
 * story in this domain; no controller yet (`NotificationLog` has no HTTP
 * surface, mirroring `SlaEscalation`'s own precedent). `TenantContext` is
 * not provided here — `SlaAtRiskNotificationListener` runs outside request
 * scope, reading `branchId` from the event payload only, the same pattern
 * `SlaEscalationListener`/`TicketEscalationListener` already use.
 */
@Module({
  providers: [SlaAtRiskNotificationListener],
})
export class NotificationsModule {}
```

### 4 — `SlaAtRiskNotificationListener`

Create file: `apps/api/src/modules/notifications/sla-at-risk-notification.listener.ts`

```typescript
import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { SLA_AT_RISK_EVENT } from "../sla-policies/sla-detection.events";
import type { SlaAtRiskEvent } from "../sla-policies/sla-detection.events";

const UNIQUE_CONSTRAINT_VIOLATION = "P2002";

/**
 * The first real reaction to `sla.at_risk` (Story 15) — never `sla.breached`
 * (Story 17 owns that, independently). Persists one `NotificationLog` row,
 * keyed on `(eventType, ticketId, targetType, targetAt)` — not
 * `slaTicketTargetId`, for the identical reason `SlaEscalationListener`
 * (Story 17) already established: that id stays constant across a Story 16
 * recategorization recompute while `targetAt` is what genuinely changes.
 * This is a record-only reaction — no recipient resolution, no template
 * rendering, no delivery, no follow-on event. Catch-and-log throughout:
 * never rethrows, never turns an unrelated request into a failure.
 */
@Injectable()
export class SlaAtRiskNotificationListener {
  private readonly logger = new Logger(SlaAtRiskNotificationListener.name);

  constructor(private readonly prisma: PrismaService) {}

  @OnEvent(SLA_AT_RISK_EVENT)
  async onSlaAtRisk(event: SlaAtRiskEvent): Promise<void> {
    try {
      await this.prisma.notificationLog.create({
        data: {
          eventType: SLA_AT_RISK_EVENT,
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
          `Ticket ${event.ticketId} already has a logged at-risk notification for ${event.targetType} target at ${event.targetAt.toISOString()}`,
        );
        return;
      }
      this.logger.error("Failed to persist NotificationLog for sla.at_risk", error as Error);
    }
  }
}
```

### 5 — Register `NotificationsModule` in `AppModule`

File: `apps/api/src/app.module.ts`

Add the import (after the existing `SlaPoliciesModule` import, current line 18):

```typescript
import { NotificationsModule } from "./modules/notifications/notifications.module";
```

Add to `imports` (current lines 34-37, after `SlaPoliciesModule`):

```typescript
    SlaPoliciesModule,
    NotificationsModule,
```

No other change to this file.

### 6 — Migration

With Docker Postgres up (use the documented temporary `5433:5432` fallback if the native PostgreSQL service is again occupying `5432` — revert immediately after, exactly as prior stories did), run:

```bash
pnpm --filter @crm/api exec prisma migrate dev --name add_notification_logs
```

Must generate exactly one migration: `CREATE SCHEMA IF NOT EXISTS "notifications";`, one `CREATE TABLE "notifications"."notification_logs"`, one unique index on `(event_type, ticket_id, target_type, target_at)`, one FK to `ticketing.tickets` with `ON DELETE CASCADE` — no FK to `sla_ticket_targets` or `sla_policies`. Read the generated `migration.sql` before trusting it.

---

## Edge Cases & Failure Modes

- **The identical `(eventType, ticketId, targetType, targetAt)` transition is delivered twice** (the same `EventEmitter2` at-least-once risk Story 15's own edge cases documented, and Story 17 already closed for `sla.breached`): the second `create` hits the unique constraint, is caught, logged at `log` level, no second row. Enforced in `SlaAtRiskNotificationListener.onSlaAtRisk` (Task 4).
- **A ticket is recategorized (Story 16) and later re-enters the at-risk window under the recomputed target:** `targetAt` differs from the original at-risk transition's `targetAt`, so a second, independent `NotificationLog` row is correctly created — not suppressed. Enforced by the composite unique key (Task 2) including `targetAt`, not `slaTicketTargetId`.
- **`sla.breached` fires:** no handler in this story subscribes to it; nothing happens (Design item 4 of Story 17's own listener remains the sole `sla.breached` consumer, unmodified).
- **`NotificationLog.create` fails for a reason other than the unique constraint:** caught, logged at `error` level, no row persisted — the ticket remains correctly eligible for logging on the next delivery of that same or a later transition.
- **A target's `SlaTicketTarget` row no longer exists by the time this listener runs** (deleted by `SlaTargetListener.onTicketRecategorized` between at-risk detection and this reaction): irrelevant to this story — `SlaAtRiskNotificationListener` never reads `SlaTicketTarget` (Design item 3), so there is nothing to race against.
- **A ticket is hard-deleted** (not a real path anywhere in this codebase today, but the schema still declares it): `NotificationLog.ticket`'s `onDelete: Cascade` removes its rows along with the ticket, the same precedent every other `sla`/`ticketing`-adjacent table already uses.

---

## Test Plan

1. **Unit — `apps/api/src/modules/notifications/sla-at-risk-notification.listener.spec.ts` (new):** hand-built `PrismaService` mock (mirroring `sla-escalation.listener.spec.ts`'s `buildPrismaMock`/`buildUniqueConstraintError` pattern). Cover: a first-time at-risk transition persists a `NotificationLog` row with the exact payload fields (`eventType: "sla.at_risk"`, `ticketId`, `branchId`, `targetType`, `targetAt`); a mocked `P2002` `Prisma.PrismaClientKnownRequestError` on `create` is caught and does not throw; a non-`P2002` error is caught and does not throw; a second, genuinely-distinct `targetAt` for the same ticket/targetType persists a second, independent row (not suppressed); the listener does not subscribe to `SLA_BREACHED_EVENT` (assert `listener.onSlaBreached` is `undefined`, mirroring `sla-escalation.listener.spec.ts`'s own "does not subscribe to sla.at_risk" assertion style in reverse).
2. **Integration — `apps/api/test/sla-at-risk-notification.e2e-spec.ts` (new):** real Postgres + Redis, following `sla-breach-escalation.e2e-spec.ts`'s exact pattern — `moduleRef.get(PrismaService)` resolved directly (no HTTP endpoint exposes `NotificationLog`), `moduleRef.get(EventEmitter2)` used to emit `SLA_AT_RISK_EVENT` directly (isolating this reaction from Story 15's live 60-second scheduler cadence). Creates a real ticket via the HTTP API, emits `sla.at_risk` for it, polls `prisma.notificationLog.findMany({ where: { ticketId, targetType: "response", targetAt } })` until exactly one row exists; emits the identical event a second time and confirms no second row after a brief wait; emits a second, distinct `targetAt` for the same ticket/targetType and confirms a second, independent row is created.
3. **Regression — no changes, re-run only:** every existing unit spec and every existing `*.e2e-spec.ts` in `apps/api` — confirm nothing else regresses, in particular `sla-escalation.listener.spec.ts`/`ticket-escalation.listener.spec.ts`/`sla-breach-escalation.e2e-spec.ts` (Story 17 behavior unchanged) and `apps/worker`'s own suites (Story 15 behavior unchanged, this story touches neither).

---

## Migration / Rollback

Additive only: one new Postgres schema (`notifications`), one new table (`notification_logs`), one new FK to `ticketing.tickets`, one new back-relation field on the existing `Ticket` Prisma model — no existing column, constraint, index, table, or schema is touched. If the migration fails partway, fix and re-run; no existing data is at risk.

---

## Verification Steps

1. **Prisma:** `pnpm --filter @crm/api prisma:validate`.
2. **Backend builds:** `pnpm --filter @crm/api typecheck`, `lint`, `build`.
3. **Workspace builds:** `pnpm typecheck`, `pnpm lint`, `pnpm build` at the repository root.
4. **Unit tests:** `pnpm --filter @crm/api test`.
5. **Live infra:** `docker compose up -d postgres redis` (temporary `5433` fallback if needed, reverted immediately after); `pnpm --filter @crm/api exec prisma migrate dev --name add_notification_logs`; `pnpm --filter @crm/api prisma:seed` (idempotency check).
6. **Integration tests:** `pnpm --filter @crm/api test:e2e`. Run at least twice to confirm no flakiness from the fire-and-forget event chain.
7. **Regression:** confirm the full existing `apps/api` unit + e2e suite is otherwise unaffected, and that `apps/worker`'s own unit/e2e suites (Story 15, untouched by this story) still pass.
8. **Hygiene:** `git status`; confirm `.squad/config.yaml` has an empty diff; confirm `apps/worker/**`, `apps/api/src/queues/**`, `apps/api/src/modules/sla-policies/business-hours-calculator.ts`, `apps/api/src/modules/sla-policies/sla-escalation.listener.ts`, and `apps/api/src/modules/tickets/ticket-escalation.listener.ts` all have empty diffs.
9. **CI:** `gh run list --workflow=ci.yml --limit 5` if `gh` is reachable; otherwise report CI verification as explicitly pending — never assumed.

## Done Criteria

- [ ] A first-time `sla.at_risk` for a given `(eventType, ticketId, targetType, targetAt)` persists exactly one `NotificationLog` row.
- [ ] A duplicate delivery of the identical transition persists no second row.
- [ ] A distinct `targetAt` for the same ticket/targetType (post-Story-16-recategorization) is treated as a new, independent log entry.
- [ ] `sla.breached` never causes any `NotificationLog` row (this listener does not subscribe to it).
- [ ] No `ticket.escalated` is emitted or caused by this story.
- [ ] No `Ticket`, `SlaTicketTarget`, or `SlaPolicy` field is written anywhere in this story's code.
- [ ] No `AutomationRule` model or generic trigger/condition/action evaluation is introduced.
- [ ] No new HTTP endpoint, `@RequirePermissions` permission, or frontend change.
- [ ] No new BullMQ queue and no `apps/worker` change.
- [ ] `NotificationsModule` does not import `SlaPoliciesModule`/`TicketsModule`, and neither imports it — communication is via the existing global `EventEmitter2` only.
- [ ] `apps/worker/**`, `apps/api/src/queues/**`, `business-hours-calculator.ts`, and all of Story 17's escalation code are byte-for-byte unchanged.
- [ ] The migration is additive-only (new schema, new table, no existing object touched).
- [ ] `.squad/config.yaml` is untouched.
- [ ] Full existing lint/typecheck/build/test suite (Identity & Access, Customer Management, Ticketing, SLA Policy Foundation, Background Job Producer Foundation, SLA Timer Detection Foundation, Ticket Recategorization, SLA Breach Escalation) still passes with no regressions.

---

**STOP HERE. Report to the user and wait for confirmation before implementing.**
