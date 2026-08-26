# Story 11 — SLA Target Computation

## Prerequisites

- `sla-policy-foundation` Story 10 completed (see [10-story-sla-policy-foundation.md](./10-story-sla-policy-foundation.md), implemented and committed as `b0bc708`): the real, branch-scoped `SlaPolicy` model and `SlaPoliciesService`/`sla` Postgres schema this story reads from. Story 10 explicitly deferred all target computation — that deferral is what this story fills in.
- `ticketing` Stories 07–09 completed (see [../ticketing/07-story-ticket-and-assignment-foundation.md](../ticketing/07-story-ticket-and-assignment-foundation.md), [08-story-ticketing-domain-events-foundation.md](../ticketing/08-story-ticketing-domain-events-foundation.md), [09-story-ticket-history-timeline.md](../ticketing/09-story-ticket-history-timeline.md)): the real `ticket.created` event (`TicketCreatedEvent`) this story subscribes to, and `TicketHistoryListener`'s catch-and-log "first real subscriber" shape this story's own listener mirrors.
- `project-foundation` Stories 01–05 completed: `TenantContext` (`apps/api/src/common/tenant/tenant-context.ts`), the globally-registered `AuthGuard`/`PermissionsGuard`/`AuditInterceptor` (`apps/api/src/app.module.ts`), and the seed/test conventions all exist exactly as built and are reused unchanged.
- This is the second story of the `sla-policy-foundation` feature. Per the intake (`.squad/stories/sla-policy-foundation/sla-target-computation/intake.md`), four decisions are already confirmed and binding (see "Settled decisions" below, items 1–4); two were explicitly left open for this plan to resolve from repository evidence (items 5–6).

---

## Settled decisions (binding for this story — do not re-open)

1. **New model ownership:** the new persistence model (`SlaTicketTarget`) belongs to the `sla` Postgres schema, not `ticketing` — it is the SLA module's own derived data about a ticket, mirroring how `ticketing.TicketHistoryEntry` stayed inside `ticketing`. *(Intake decision 1.)*
2. **Listener scope:** the new listener reacts to `ticket.created` only — never `ticket.updated`, and no new `ticket.recategorized` event is introduced. *(Intake decision 2.)*
3. **Feature slug:** this story continues under the existing `sla-policy-foundation` slug. *(Intake decision 3.)*
4. **No uniqueness constraint is added to `SlaPolicy`** — Story 10 deliberately left it unconstrained; this story reads it as-is. *(Intake decision 4, restated.)*
5. **Policy-resolution rule (resolved by this plan):** when more than one active `SlaPolicy` matches a ticket's `branchId`/`departmentId`/`category`/`priority`, **the most specific match wins** — score each candidate by how many of its three optional dimensions (`departmentId`, `category`, `priority`) are non-null, and pick the highest score. **Ties are broken by earliest `createdAt`** (the first policy an admin created for that exact scope). This is the standard "most-specific-wins" resolution shape for optional/wildcard scoping dimensions, it requires no schema change, and it is fully deterministic. No other rule (e.g. most-recently-created-wins, or an explicit priority-ordering field) is introduced.
6. **A read endpoint is included:** `GET /api/v1/tickets/:id/sla-target`, reusing the **existing** `sla:read` permission (no new permission key). Justification: (a) this repository's e2e convention is to build every fixture and every assertion through real API calls, never direct DB inspection (see every existing `*.e2e-spec.ts`) — without a read endpoint, this story's own e2e tests would have no way to observe that the listener wrote anything; (b) it mirrors `ticketing` Story 09's own reasoning for pairing a "first real subscriber" listener with a read endpoint (`GET /tickets/:id/history`) rather than leaving newly-persisted data completely unreadable.
7. **Where the new code lives:** the listener, the read service, and the read controller are all added to the **existing** `SlaPoliciesModule` — no new NestJS module is created. The controller is routed under `/tickets` (not `/sla-policies`), because from an API consumer's perspective this is "this ticket's SLA target" — nothing prevents a second controller declaring routes under an existing path prefix, and this exact shape (one module, two controllers, one of them named after the *other* domain's resource) mirrors `CustomersModule` already hosting both `CustomersController` and `ContactsController`.
8. **Cross-schema Prisma access, as already established (not a new precedent):** `docs/architecture/03-domain-boundaries.md` Rule 1 states a module should read another module's data "only through exported service methods... never by importing another module's Prisma model directly." The actual code has not followed that rule since `ticketing` Story 07: `TicketsService` already calls `this.prisma.customer.findFirst(...)`, `this.prisma.department.findFirst(...)`, and `this.prisma.userBranchRole.findFirst(...)` directly. This story follows that same **established practice**, not the aspirational doc rule: `SlaTargetListener` and `SlaTargetsService` both query `this.prisma.ticket...` directly. This is called out explicitly so it isn't mistaken for a new inconsistency introduced by this story.
9. **No recomputation, no idempotency logic, no queue.** `EventEmitter2.emit()` stays synchronous (no `emitAsync`); a target, once created, is immutable — there is no `ticket.updated` handler to recompute it.

---

## Story Goal

Make `SlaPolicy` (Story 10) actually do something: the first real consumer of a policy. A new listener subscribes to the existing `ticket.created` event and, when an active `SlaPolicy` matches the new ticket's branch/department/category/priority, computes and persists absolute response/resolution target timestamps for that ticket — using the deterministic "most-specific-match-wins" resolution rule (Settled decision 5). A new minimal read endpoint, `GET /api/v1/tickets/:id/sla-target`, exposes the computed target (or 404 if none exists). This is exactly the "first real subscriber" shape `ticketing` Story 09 used for `TicketHistoryListener` — a listener that reacts to an existing, unchanged event, persists a new record, and catches and logs its own persistence failures so they can never break the original ticket-creation request.

**Not in scope:** business-hours/holiday-aware computation, `ticket.updated`/`ticket.recategorized` reactions or recomputation, `sla-timers`, breach/at-risk detection (`sla.at_risk`/`sla.breached`), escalation, `AutomationRule`, or any change to the existing Ticketing event contract. All deferred per the intake's "Out of scope" list.

---

## Context — Read These Files First

1. [docs/architecture/07-sla-automation-and-ai.md](../../../docs/architecture/07-sla-automation-and-ai.md) — line 8: "SLA targets are computed when a ticket is created or recategorized by `SlaModule` reacting to `ticket.created` and `ticket.recategorized`." This story implements only the `ticket.created` half (Settled decision 2); the `ticket.recategorized` half is explicitly deferred, per the intake, to a future story.
2. [docs/architecture/03-domain-boundaries.md](../../../docs/architecture/03-domain-boundaries.md) — line 11 (`SLA & Automation` row: "Subscribes to ticketing events") and line 22 (Rule 1, the cross-module-access rule this story follows established practice over — see Settled decision 8).
3. `apps/api/src/modules/tickets/tickets.events.ts` (16 lines, read in full) — `TICKET_CREATED_EVENT`/`TicketCreatedEvent`, unchanged by this story.
4. `apps/api/src/modules/tickets/tickets.service.ts` — the `TicketSummary` interface (lines 11-21): **does not include `branchId` or `createdAt`**. This is why the listener re-fetches the ticket row by id rather than trusting the event payload for those two fields (see Task 3).
5. `apps/api/src/modules/tickets/ticket-history.listener.ts` (53 lines, read in full) and `ticket-history.listener.spec.ts` (82 lines, read in full) — the exact "first real subscriber" catch-and-log shape and hand-built-mock test pattern this story's `SlaTargetListener`/`sla-target.listener.spec.ts` mirror.
6. `apps/api/src/modules/tickets/tickets.module.ts` (21 lines, read in full) — confirms `@OnEvent` listeners are auto-discovered once the class is registered as a provider in any module; no separate wiring is needed beyond adding `SlaTargetListener` to `SlaPoliciesModule`'s `providers`.
7. `apps/api/src/modules/sla-policies/sla-policies.service.ts` (140 lines, read in full) — `SlaPolicySummary`, `findSlaPolicyInScope`'s 404-not-403 convention, and the existing branch-scoping shape this story's read path (`SlaTargetsService`) mirrors.
8. `apps/api/src/modules/sla-policies/sla-policies.module.ts` (16 lines, read in full) and `sla-policies.controller.ts` (38 lines, read in full) — both are extended by this story (Task 4), not replaced.
9. `apps/api/src/common/tenant/tenant-context.ts` (65 lines, read in full) — `requireBranchScope()`, reused unchanged.
10. `apps/api/prisma/schema.prisma` — the current `Ticket` model (lines 255-280) and `SlaPolicy` model (lines 318-335), and the `sla` schema section's closing line (336) where the new model is appended. `Ticket.priority` is the `TicketPriority` enum (line 269); `SlaPolicy.priority` is a plain nullable `String` (line 325, Story 10's deliberate cross-schema-enum avoidance) — the listener's priority filter must compare across that type boundary (see Task 3).
11. `apps/api/prisma/migrations/20260826110531_add_sla_policies/migration.sql` (read in full) — confirms Prisma's implicit `onDelete` defaults actually generated for this codebase: `RESTRICT` for a required relation (`branch_id`), `SET NULL` for an optional one (`department_id`) — informs Task 1's explicit `onDelete: Cascade` choice for `SlaTicketTarget.ticket`, which is *not* relying on an implicit default but mirroring `TicketHistoryEntry.ticket`'s own explicit `onDelete: Cascade` (schema.prisma line 291) exactly, since both are records scoped through a parent `Ticket` with no independent lifecycle.
12. `apps/api/prisma/seed.ts` — `PERMISSION_CATALOG` (lines 19-34) already ends in `"sla:create", "sla:read", "sla:update"` from Story 10. **No edit to this file is needed** — the new read endpoint reuses `sla:read` (Settled decision 6).
13. `apps/api/src/app.module.ts` (50 lines, read in full) — already imports `SlaPoliciesModule`; **no edit needed**, since this story only adds providers/controllers inside that existing module.
14. `apps/api/test/sla-policies.e2e-spec.ts` (207 lines, read in full) — the real-`AppModule`/real-Postgres e2e bootstrap, admin login, `GET /api/v1/auth/me` department-id pattern, and Agent-fixture-creation-via-API pattern for `403` tests, all reused unchanged by this story's new e2e file. Note its own fixtures (a deactivated wildcard policy, and an active `category: "billing"`/`priority: "HIGH"` scoped policy) are left in the shared seeded database after it runs — this story's own e2e suite must not rely on or collide with that leftover state; it creates its own dedicated `SlaPolicy` fixtures scoped by a fresh, randomly-generated `category` value instead (see Task 6).

---

## Product rules (from story)

- **Current:** `SlaPolicy` exists (Story 10) but is never read by anything; no ticket ever gets a computed target.
- **New:** a `sla`-schema `SlaTicketTarget` model, computed once per ticket by a new listener reacting to `ticket.created`, using the deterministic most-specific-match resolution rule; a new `GET /api/v1/tickets/:id/sla-target` endpoint (permission: existing `sla:read`) to read it back.

---

## Implementation Tasks

### 1 — Prisma schema

File: `apps/api/prisma/schema.prisma`

Add a back-relation field to the **existing** `Ticket` model (schema-file-only, no column, no migration SQL — same pattern as every prior back-relation in this file), immediately after `historyEntries`:

```prisma
  historyEntries   TicketHistoryEntry[]
  slaTarget        SlaTicketTarget?
```

Add a back-relation field to the **existing** `SlaPolicy` model, immediately after `updatedAt`:

```prisma
  updatedAt               DateTime    @default(now()) @map("updated_at")
  targets                 SlaTicketTarget[]
```

Append a new model at the end of the `sla` schema section (after `SlaPolicy`):

```prisma
/// The first row of runtime SLA automation state (see
/// docs/architecture/07-sla-automation-and-ai.md, "SLA targets are computed
/// when a ticket is created... by `SlaModule` reacting to `ticket.created`")
/// — computed once, when a ticket is created, and never mutated (this story
/// does not react to `ticket.updated`, see Story 11's "Settled decisions").
/// Strict 1:1 with `Ticket` (`ticketId` is `@unique`), not an append-only
/// log, because no recomputation happens. `slaPolicyId` is kept only for
/// traceability. Absolute timestamps (`responseTargetAt`/`resolutionTargetAt`),
/// not raw minute counts, so a later edit to the matched `SlaPolicy` never
/// retroactively changes an already-computed target. No `branchId` — scope
/// is always derived through the parent `Ticket`, the same precedent
/// `TicketHistoryEntry` and `customers.Contact` already established.
/// `onDelete: Cascade` on `ticket` mirrors `TicketHistoryEntry.ticket`'s own
/// explicit choice exactly (schema.prisma, `TicketHistoryEntry` model).
model SlaTicketTarget {
  id                 String    @id @default(uuid())
  ticketId           String    @unique @map("ticket_id")
  ticket             Ticket    @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  slaPolicyId        String    @map("sla_policy_id")
  slaPolicy          SlaPolicy @relation(fields: [slaPolicyId], references: [id])
  responseTargetAt   DateTime  @map("response_target_at")
  resolutionTargetAt DateTime  @map("resolution_target_at")
  createdAt          DateTime  @default(now()) @map("created_at")

  @@map("sla_ticket_targets")
  @@schema("sla")
}
```

Run `pnpm --filter @crm/api prisma:validate` after editing — must pass with no relation errors.

### 2 — Migration

With Docker Postgres up (`docker compose up -d postgres redis`, using the documented temporary `5433:5432` port fallback if the native PostgreSQL 18 service is again occupying `5432` — revert both `docker-compose.yml` and `apps/api/.env` immediately after, exactly as Stories 06–10 did), run:

```bash
pnpm --filter @crm/api exec prisma migrate dev --name add_sla_ticket_targets
```

This must generate exactly one new migration containing one `CREATE TABLE "sla"."sla_ticket_targets"`, a unique constraint/index on `ticket_id`, the two foreign keys (`ticket_id` → `ticketing.tickets` with `ON DELETE CASCADE`, `sla_policy_id` → `sla.sla_policies` with the implicit `ON DELETE RESTRICT` default) — and **no** `ALTER TABLE` on any existing table (the two back-relation fields from Task 1 produce no SQL). Read the generated `migration.sql` before trusting it.

### 3 — `SlaTargetListener`

Create file: `apps/api/src/modules/sla-policies/sla-target.listener.ts`

```typescript
import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { PrismaService } from "../../prisma/prisma.service";
import { TICKET_CREATED_EVENT } from "../tickets/tickets.events";
import type { TicketCreatedEvent } from "../tickets/tickets.events";

const MINUTE_MS = 60_000;

interface PolicyCandidate {
  id: string;
  departmentId: string | null;
  category: string | null;
  priority: string | null;
  responseTargetMinutes: number;
  resolutionTargetMinutes: number;
}

/**
 * The second real subscriber to `TicketsService`'s events (after
 * `TicketHistoryListener`) — reacts to `ticket.created` only (Settled
 * decision 2), never `ticket.updated`. Mirrors `TicketHistoryListener`'s
 * catch-and-log pattern exactly: a computation/persistence failure here must
 * never turn a successful ticket-creation request into a failed one.
 *
 * `TicketCreatedEvent.ticket` (a `TicketSummary`) carries no `branchId` or
 * `createdAt` — this listener re-fetches the fields it needs by
 * `event.ticket.id` rather than relying on the event payload for those, so
 * the existing event contract never needs to change (Settled decision 8).
 */
@Injectable()
export class SlaTargetListener {
  private readonly logger = new Logger(SlaTargetListener.name);

  constructor(private readonly prisma: PrismaService) {}

  @OnEvent(TICKET_CREATED_EVENT)
  async onTicketCreated(event: TicketCreatedEvent): Promise<void> {
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

      const departmentFilter = ticket.departmentId
        ? { OR: [{ departmentId: null }, { departmentId: ticket.departmentId }] }
        : { departmentId: null };
      const categoryFilter = ticket.category
        ? { OR: [{ category: null }, { category: ticket.category }] }
        : { category: null };
      const priorityFilter = { OR: [{ priority: null }, { priority: ticket.priority as string }] };

      const candidates = await this.prisma.slaPolicy.findMany({
        where: {
          branchId: ticket.branchId,
          isActive: true,
          AND: [departmentFilter, categoryFilter, priorityFilter],
        },
        orderBy: { createdAt: "asc" },
      });

      const bestPolicy = this.selectMostSpecificPolicy(candidates);
      if (!bestPolicy) {
        return;
      }

      await this.prisma.slaTicketTarget.create({
        data: {
          ticketId: event.ticket.id,
          slaPolicyId: bestPolicy.id,
          responseTargetAt: new Date(
            ticket.createdAt.getTime() + bestPolicy.responseTargetMinutes * MINUTE_MS,
          ),
          resolutionTargetAt: new Date(
            ticket.createdAt.getTime() + bestPolicy.resolutionTargetMinutes * MINUTE_MS,
          ),
        },
      });
    } catch (error) {
      this.logger.error("Failed to compute SLA target for ticket.created", error as Error);
    }
  }

  /**
   * Deterministic policy-resolution rule (Settled decision 5): the
   * candidate with the most non-null scoping dimensions wins ("most
   * specific match wins"). Ties are broken by earliest `createdAt` —
   * `candidates` is pre-sorted `createdAt: "asc"` by the caller, so the
   * first candidate seen at a given score is already the earliest; this
   * loop only replaces `best` on a strictly higher score.
   */
  private selectMostSpecificPolicy(candidates: PolicyCandidate[]): PolicyCandidate | null {
    let best: PolicyCandidate | null = null;
    let bestScore = -1;
    for (const candidate of candidates) {
      const score =
        (candidate.departmentId !== null ? 1 : 0) +
        (candidate.category !== null ? 1 : 0) +
        (candidate.priority !== null ? 1 : 0);
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    return best;
  }
}
```

### 4 — `SlaTargetsService` and `SlaTargetsController` (read path)

Create file: `apps/api/src/modules/sla-policies/sla-targets.service.ts`

```typescript
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "../../common/tenant/tenant-context";

export interface SlaTargetSummary {
  id: string;
  ticketId: string;
  slaPolicyId: string;
  responseTargetAt: Date;
  resolutionTargetAt: Date;
}

/**
 * Read-only access to a ticket's computed SLA target. Owns the `sla` schema
 * the same way `SlaPoliciesService` does, but scopes through the parent
 * `Ticket` (mirroring `TicketsService.getTicketHistory`'s scope-through-
 * parent shape) since `SlaTicketTarget` carries no `branchId` of its own.
 */
@Injectable()
export class SlaTargetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async getSlaTargetForTicket(ticketId: string): Promise<SlaTargetSummary> {
    const { branchId } = this.tenantContext.requireBranchScope();

    const ticket = await this.prisma.ticket.findFirst({ where: { id: ticketId, branchId } });
    if (!ticket) {
      throw new NotFoundException("Ticket not found");
    }

    const target = await this.prisma.slaTicketTarget.findUnique({ where: { ticketId } });
    if (!target) {
      throw new NotFoundException("SLA target not found for this ticket");
    }

    return {
      id: target.id,
      ticketId: target.ticketId,
      slaPolicyId: target.slaPolicyId,
      responseTargetAt: target.responseTargetAt,
      resolutionTargetAt: target.resolutionTargetAt,
    };
  }
}
```

Create file: `apps/api/src/modules/sla-policies/sla-targets.controller.ts`

```typescript
import { Controller, Get, Param } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../common/auth/require-permissions.decorator";
import type { SlaTargetSummary } from "./sla-targets.service";
import { SlaTargetsService } from "./sla-targets.service";

/**
 * Deliberately routed under `/tickets`, not `/sla-policies` — this is "the
 * SLA target belonging to this ticket," a ticket-scoped read, even though
 * the owning module/schema is `sla` (Settled decision 1/7). Nothing prevents
 * a second controller declaring routes under an existing path prefix; this
 * mirrors `CustomersModule` already hosting two controllers
 * (`CustomersController` + `ContactsController`).
 */
@ApiTags("sla-targets")
@ApiBearerAuth()
@Controller("tickets")
export class SlaTargetsController {
  constructor(private readonly slaTargetsService: SlaTargetsService) {}

  @Get(":id/sla-target")
  @RequirePermissions("sla:read")
  getOne(@Param("id") id: string): Promise<SlaTargetSummary> {
    return this.slaTargetsService.getSlaTargetForTicket(id);
  }
}
```

### 5 — Wire into the existing `SlaPoliciesModule`

File: `apps/api/src/modules/sla-policies/sla-policies.module.ts` — replace in full:

```typescript
import { Module } from "@nestjs/common";
import { TenantContext } from "../../common/tenant/tenant-context";
import { SlaPoliciesController } from "./sla-policies.controller";
import { SlaPoliciesService } from "./sla-policies.service";
import { SlaTargetListener } from "./sla-target.listener";
import { SlaTargetsController } from "./sla-targets.controller";
import { SlaTargetsService } from "./sla-targets.service";

/**
 * Owns the `sla` schema — see docs/architecture/03-domain-boundaries.md
 * ("SLA & Automation"). `TenantContext` is provided here the same way
 * `CustomersModule`/`TicketsModule` provide it. `SlaTargetListener`'s
 * `@OnEvent` handler is discovered automatically by `EventEmitterModule`
 * once the class is instantiated as a provider here — the same pattern
 * `TicketsModule` uses for `TicketHistoryListener`.
 */
@Module({
  controllers: [SlaPoliciesController, SlaTargetsController],
  providers: [SlaPoliciesService, SlaTargetsService, TenantContext, SlaTargetListener],
  exports: [SlaPoliciesService, SlaTargetsService],
})
export class SlaPoliciesModule {}
```

No `app.module.ts` edit — `SlaPoliciesModule` is already registered. No `seed.ts` edit — the read endpoint reuses the existing `sla:read` key (Settled decision 6).

### 6 — Tests

Create file: `apps/api/src/modules/sla-policies/sla-target.listener.spec.ts`

Structure exactly like `ticket-history.listener.spec.ts` (hand-built `PrismaService` mock, no `Test.createTestingModule`). Cover:

- Re-fetches the ticket by `event.ticket.id` via `prisma.ticket.findUnique`.
- Ticket not found on re-fetch (defensive edge case) → no `slaTicketTarget.create` call, resolves without throwing.
- No active candidate policy matches → no `slaTicketTarget.create` call.
- Exactly one matching wildcard policy (`departmentId`/`category`/`priority` all `null`) → a target is created with `responseTargetAt`/`resolutionTargetAt` equal to the ticket's `createdAt` plus the policy's minute counts.
- Two candidates with different specificity (one wildcard, one scoped by `category` only) → the more specific one is used.
- Two candidates with equal (highest) specificity, different `createdAt` → the earlier-created one is used.
- `prisma.slaTicketTarget.create` rejects → caught and logged, `onTicketCreated` still resolves without throwing (mirrors `ticket-history.listener.spec.ts`'s own "does not throw when persistence fails" case).

Create file: `apps/api/src/modules/sla-policies/sla-targets.service.spec.ts`

Structure like `sla-policies.service.spec.ts` (hand-built `PrismaService`/`TenantContext` mocks). Cover:

- `getSlaTargetForTicket` throws `NotFoundException` when the ticket isn't in the caller's branch (`prisma.ticket.findFirst` returns `null`).
- Throws `NotFoundException` when the ticket is in scope but has no target (`prisma.slaTicketTarget.findUnique` returns `null`).
- Returns the mapped `SlaTargetSummary` when both exist.

Create file: `apps/api/test/sla-targets.e2e-spec.ts`

Bootstrap the real `AppModule` exactly as `sla-policies.e2e-spec.ts` does (same admin login, same `GET /api/v1/auth/me` pattern). This suite creates its **own** dedicated `SlaPolicy` fixture scoped by a freshly-generated `category` (`randomUUID()`) rather than relying on or colliding with `sla-policies.e2e-spec.ts`'s leftover fixtures in the shared seeded database (see Context item 14). Cover:

1. `GET /api/v1/tickets/:id/sla-target` with no `Authorization` header → `401`.
2. Create a `SlaPolicy` via `POST /api/v1/sla-policies` scoped only by a fresh `category` (a `randomUUID()` value used nowhere else), with distinct `responseTargetMinutes`/`resolutionTargetMinutes` (e.g. 30/240). Create a `Customer` (`POST /api/v1/customers`) and a `Ticket` (`POST /api/v1/tickets`) using that same `category`. `GET /api/v1/tickets/:id/sla-target` immediately after → `200`; assert `resolutionTargetAt` minus `responseTargetAt` (parsed as dates) equals exactly `(240 - 30) * 60_000` ms — a precise, order-independent invariant that doesn't require knowing the ticket's exact `createdAt` (which the ticket API response doesn't expose either, per `TicketSummary`).
3. Create a second `Ticket` using a different, freshly-generated `category` that matches no `SlaPolicy` created anywhere in this run. `GET /api/v1/tickets/:id/sla-target` → `404`.
4. `GET /api/v1/tickets/:id/sla-target` for a random unknown ticket UUID → `404`.
5. Create an Agent-role user via the API (same pattern as `sla-policies.e2e-spec.ts`'s own `403` test), log in as them, and confirm `GET /api/v1/tickets/:id/sla-target` on the matching ticket from step 2 → `403` (the seeded `Agent` role has zero permissions, including `sla:read`).

---

## Edge Cases & Failure Modes

- **No `SlaPolicy` matches the new ticket's branch/department/category/priority:** no target is created — a valid, non-error outcome (intake acceptance criterion), not logged as a failure.
- **Multiple equally-specific policies match:** resolved deterministically by earliest `createdAt` (Settled decision 5) — never ambiguous, never random.
- **The re-fetched ticket row is somehow missing (defensive only — no code path deletes a `Ticket` today):** the listener returns early without creating a target or throwing.
- **`prisma.slaTicketTarget.create` fails (e.g. a concurrent duplicate — `ticketId` is unique, so a second `ticket.created` for the same id, which cannot happen today since ticket ids are freshly generated per create, is defensively still just caught and logged):** caught, logged via `Logger.error`, never rethrown — mirrors `TicketHistoryListener` exactly.
- **`EventEmitter2.emit()` is synchronous but the listener is `async`:** the same microtask-timing property `TicketHistoryListener`'s own e2e tests already rely on successfully — code before the listener's first `await` runs synchronously inside `emit()`, and the remaining awaited work reliably completes before a Supertest response is fully processed, exactly as already proven by `ticket-history.e2e` coverage. No artificial delay or retry is introduced here either.
- **`GET /tickets/:id/sla-target` for a ticket that exists but was created *before* this story shipped (no target was ever computed for it):** `404` — behaviorally identical to "no policy matched," which is correct: neither case is an error, both mean "no target exists for this ticket."
- **`GET /tickets/:id/sla-target` for a ticket outside the caller's branch:** `404` via the same branch-scoped `findFirst` on `Ticket` every other module uses — never `403`, never distinguishing "doesn't exist" from "exists in another branch."
- **A ticket's `category`/`priority` changes later via `PATCH /tickets/:id`:** no recomputation occurs (Settled decision 9) — the originally-computed target (if any) is left exactly as it was. This is intentional, not a bug.

---

## Test Plan

1. **Unit — `apps/api/src/modules/sla-policies/sla-target.listener.spec.ts` (new):** all cases in Task 6, following `ticket-history.listener.spec.ts`'s hand-built-mock pattern. No database dependency.
2. **Unit — `apps/api/src/modules/sla-policies/sla-targets.service.spec.ts` (new):** all cases in Task 6, following `sla-policies.service.spec.ts`'s pattern. No database dependency.
3. **Integration — `apps/api/test/sla-targets.e2e-spec.ts` (new):** the 5 scenarios in Task 6, against real Postgres/Redis.
4. **Regression — no changes, re-run only:** every existing unit spec (`identity.service.spec.ts`, `permissions.guard.spec.ts`, `customers.service.spec.ts`, `tickets.service.spec.ts`, `ticket-history.listener.spec.ts`, `sla-policies.service.spec.ts`) and every existing e2e spec (`identity.e2e-spec.ts`, `customers.e2e-spec.ts`, `tickets.e2e-spec.ts`, `sla-policies.e2e-spec.ts`) must still pass unmodified.

---

## Migration / Rollback

- Purely additive: one new table (`sla.sla_ticket_targets`), a unique constraint on `ticket_id`, two foreign keys (`ticket_id` → `ticketing.tickets` `ON DELETE CASCADE`, `sla_policy_id` → `sla.sla_policies`). No existing table's columns, constraints, or data are touched.
- If the migration fails partway, fix and re-run — there is no existing data in the new table to lose, and no existing table is modified.
- Rolling back the feature entirely (if ever needed) means dropping the new table and removing the migration directory — not performed by this story.

---

## Verification Steps

1. **Prisma validates:** `pnpm --filter @crm/api prisma:validate` — must pass with the new model and both new back-relations.
2. **Backend builds:** `pnpm --filter @crm/api typecheck`, `pnpm --filter @crm/api lint`, `pnpm --filter @crm/api build`.
3. **Workspace builds:** `pnpm typecheck`, `pnpm lint`, `pnpm build` in the repository root — confirm zero regressions in `apps/web`/`apps/portal`/`apps/worker`/`packages/*`.
4. **Unit tests:** `pnpm --filter @crm/api test` — must run and pass the two new spec files alongside every existing unit suite.
5. **Live migration + seed:** `docker compose up -d postgres redis`, `pnpm --filter @crm/api exec prisma migrate deploy`, `pnpm --filter @crm/api prisma:seed` (re-run once more to confirm idempotency).
6. **Integration tests:** `pnpm --filter @crm/api test:e2e` — must pass, including the 5 new scenarios; capture full output as evidence.
7. **Regression:** confirm the full existing suite (unit + e2e) is unaffected.
8. **Hygiene:** `git status` / `git diff --stat -- .squad/config.yaml` — confirm the latter returns nothing. Confirm `docker-compose.yml`/`apps/api/.env` are reverted to port 5432 if the temporary fallback was used.
9. **CI:** no `.github/workflows/ci.yml` changes needed. Confirm via `gh run list --workflow=ci.yml --limit 5` if `gh` is reachable; otherwise report CI verification as explicitly pending — never assumed.

## Done Criteria

- [ ] `SlaTicketTarget` exists in the `sla` schema with `ticketId` (unique), `slaPolicyId`, `responseTargetAt`, `resolutionTargetAt`, `createdAt` — no `branchId`, no `updatedAt`.
- [ ] `SlaTargetListener` subscribes to `ticket.created` only; it does not modify `TicketsService`, the event contract, or any file under `apps/api/src/modules/tickets/**`.
- [ ] When an active `SlaPolicy` matches (per the most-specific-wins rule, tie-broken by earliest `createdAt`), a target is computed and persisted exactly once.
- [ ] When no policy matches, no target row is created — not an error.
- [ ] Listener persistence failures are caught and logged, never propagated to the original request.
- [ ] `GET /api/v1/tickets/:id/sla-target` exists, permission-checked with the existing `sla:read` key, returns `404` when the ticket is out of scope or has no computed target, `200` with the computed timestamps otherwise.
- [ ] No new permission key, no business-hours calendar, no `sla-timers`, no BullMQ, no `sla.at_risk`/`sla.breached`, no escalation, no `AutomationRule`, no `ticket.escalated`/`ticket.recategorized`, no recomputation, no CASL, no Notifications/Socket.IO change was introduced.
- [ ] `.squad/config.yaml` is untouched.
- [ ] The migration is additive-only.
- [ ] Unit tests cover `SlaTargetListener` (policy matching/tie-break/persistence-failure) and `SlaTargetsService` (scope/not-found/found); e2e tests cover the matching, no-match, unknown-ticket, and unauthorized-role cases.
- [ ] Full existing lint/typecheck/build/test suite (Identity & Access, Customer Management, Ticketing, SLA Policy Foundation) still passes with no regressions.

---

**STOP HERE. Report to the user and wait for confirmation before implementing.**
