# Story 08 — Ticketing: Domain Events Foundation

## Prerequisites

- `ticketing` Story 07 completed (see [07-story-ticket-and-assignment-foundation.md](./07-story-ticket-and-assignment-foundation.md), committed `a163c8a`): the `Ticket` model, `TicketsService.createTicket`/`updateTicket` (`apps/api/src/modules/tickets/tickets.service.ts`, currently 187 lines), and the full branch/cross-domain scoping logic all exist exactly as built. This story does not change any of that logic — it only adds an emission call after each method's existing persistence step already succeeds.
- Story 07's own "Settled decisions" explicitly deferred domain-event emission "to a later story." This is that story — and only that piece. Everything else Story 07 deferred (CASL, ticket history/timeline, `ticket.escalated`, and every consuming module) stays deferred; see "Settled decisions" below.

---

## Settled decisions (binding for this story — do not re-open)

1. **Scope:** domain-event emission only. Nothing else.
2. **Dependency:** add `@nestjs/event-emitter` to `apps/api`.
3. **Wiring:** register `EventEmitterModule.forRoot()` in `apps/api/src/app.module.ts`.
4. **`createTicket`:** emits `ticket.created` after successful persistence.
5. **`updateTicket`:** emits `ticket.updated` after successful persistence.
6. **No subscribers** are built in this story — no `SlaModule`, `NotificationsModule`, `ChannelsModule`, `AiModule`, or `PortalModule`, and no CASL.
7. **No ticket history/timeline.**
8. **`ticket.escalated` is not implemented** — only `ticket.created` and `ticket.updated`, the two events this story's scope explicitly names.
9. **`Ticket.externalRef` is not introduced** — that remains a future Channels concern.
10. **`.squad/config.yaml` is not modified.**

---

## Story Goal

Give `TicketsService` the ability to announce, in-process, that a ticket was created or updated — the two events `docs/architecture/03-domain-boundaries.md` names for Ticketing (a third, `ticket.escalated`, is explicitly not built here; nothing in the current `Ticket` model or `UpdateTicketDto` represents an "escalation" concept distinct from an ordinary status/priority change, so there is nothing yet to name that event after). This is infrastructure only: after this story, `TicketsService` emits events that currently have zero listeners. The value is that the next story to need one (most likely `SlaModule`, per `07-sla-automation-and-ai.md`) can subscribe without ever touching `TicketsService` again — the emission side and the consumption side are decoupled by design (`02-system-architecture-overview.md`, boundary rule 3).

**Explicitly not goals of this story:** anything that reacts to these events, `ticket.escalated`, ticket history/timeline, `Ticket.externalRef`, CASL, and any change to `TicketsService`'s existing branch/cross-domain scoping logic, DTOs, controller routes, or response shapes.

---

## Context — Read These Files First

1. [docs/architecture/03-domain-boundaries.md](../../../docs/architecture/03-domain-boundaries.md) — the `Ticketing` row names exactly `ticket.created`, `ticket.updated`, `ticket.escalated`. This story implements the first two only, per Settled decision 8.
2. [docs/architecture/02-system-architecture-overview.md](../../../docs/architecture/02-system-architecture-overview.md) — boundary rule 3: "Cross-domain communication inside `apps/api`... happens through in-process domain events (NestJS `EventEmitter2`), not by one module importing and calling another module's internals directly." This is the mechanism this story wires; no architecture decision is being made here that wasn't already recorded.
3. `apps/api/src/modules/tickets/tickets.service.ts` — lines 42–82 (`createTicket`, the exact point after `this.prisma.ticket.create(...)` resolves, line 80, where emission is added); lines 98–119 (`updateTicket` — note its current `data: {...}` write at lines 106–117 discards the updated row; this story changes that call to capture the result, since the event payload needs the post-update state, not just `{ id }`); lines 164–186 (`toTicketSummary`, reused verbatim to build both event payloads).
4. `apps/api/src/app.module.ts` — lines 1–16 (imports) and 17–32 (module `imports` array) — where `EventEmitterModule.forRoot()` is added alongside `PrismaModule`/`AuthModule`/etc.
5. `apps/api/package.json` — lines 23–44 (`dependencies`) — confirms `@nestjs/event-emitter` is not present today; this story adds it.
6. `apps/api/src/modules/tickets/tickets.service.spec.ts` (whole file, 278 lines) — the hand-built-mock pattern (`buildPrismaMock`, `buildTenantContextMock`, `createService`) this story extends with a `buildEventEmitterMock` and a third constructor argument.
7. `apps/api/test/tickets.e2e-spec.ts` (whole file, 294 lines) — the existing `beforeAll`/`afterAll` bootstrap this story's e2e addition extends (see Task 4 and "E2E verification — is it justified?" below); no existing `it` block in this file is changed, only new ones added.
8. [00-story-tech-stack-and-architecture-docs.md is not consulted here] — `docs/architecture/01-technology-stack.md` already names `EventEmitter2`/domain events as part of the backend architecture; no new architectural decision is introduced by adding the package, only an implementation of a decision already on record.

---

## Event payload contract

Two events, both carrying the same shape — the full `TicketSummary` `TicketsService` already builds for its own return values (`apps/api/src/modules/tickets/tickets.service.ts` lines 8–18). No new fields are invented beyond what `TicketSummary` already exposes; a future subscriber that needs more (e.g., branch/department names, not just ids) reads them itself via `TicketsService` or Prisma — this story does not guess at a subscriber's needs.

Create file: `apps/api/src/modules/tickets/tickets.events.ts`

```typescript
import type { TicketSummary } from "./tickets.service";

export const TICKET_CREATED_EVENT = "ticket.created";
export const TICKET_UPDATED_EVENT = "ticket.updated";

/** Emitted once, after `TicketsService.createTicket` successfully persists the row. */
export interface TicketCreatedEvent {
  ticket: TicketSummary;
}

/** Emitted once, after `TicketsService.updateTicket` successfully persists the row. */
export interface TicketUpdatedEvent {
  ticket: TicketSummary;
}
```

Two distinct interfaces (rather than one shared `TicketEvent` type) so that if `ticket.created`'s or `ticket.updated`'s payload ever needs to diverge later (e.g., `ticket.updated` gaining a "what changed" field), each event's contract can change independently without a shared type forcing a coordinated edit. Both are identical today — that's fine; the distinction is about future flexibility, not present necessity.

---

## Emission timing and failure behavior (binding)

- **`createTicket`:** the event fires **only** after `this.prisma.ticket.create({...})` (line 69–80 today) resolves without throwing. Every existing cross-domain check (`customer`/`contact`/`department`/`assignedToUserId` — lines 45–67) still runs first and still throws `NotFoundException` exactly as before; none of those paths reach the emission call, so a rejected ticket creation never emits `ticket.created`.
- **`updateTicket`:** the event fires **only** after `this.prisma.ticket.update({...})` resolves without throwing. `findTicketInScope` (unknown/out-of-scope ticket) and `requireUserInScope` (unknown/out-of-scope reassignment target) still run first and still throw before any update is attempted; neither path emits `ticket.updated`.
- **If the Prisma write itself throws** (any error — not just the pre-checked `NotFoundException` cases, but a genuine database-level failure): the exception propagates exactly as it does today; the emission line is never reached. This story does not add a `try/catch` around the Prisma call — none exists today, and none is being added now.
- **The emission call itself is not wrapped in a `try/catch`.** With zero listeners registered (Settled decision 6), `EventEmitter2.emit()` cannot throw from a listener (there are none), so there is nothing to guard against in this story. This is flagged explicitly in Edge Cases below as a forward-looking note for whichever story adds the first real listener (most likely SLA) — not a gap this story needs to close, since a guard against a hypothetical future listener's bug is speculative code with nothing to test today.
- **Emission happens synchronously, in the same request, before the method returns.** `EventEmitter2.emit()` (the default, non-async `emit`, not `emitAsync`) is fire-and-forget from the caller's perspective but runs any listener synchronously within the same call stack. With zero listeners this has no observable effect; it is noted here because it is the exact mechanism a future listener will run under, and that choice (`emit` vs. `emitAsync`) is being made now, not deferred.

---

## Implementation Tasks

### 1 — Add the dependency

```bash
pnpm --filter @crm/api add @nestjs/event-emitter
```

(Let `pnpm` resolve the current compatible version against the already-installed `@nestjs/common@^11.2.1` — do not hand-write a version number into `package.json`.)

### 2 — Register `EventEmitterModule`

File: `apps/api/src/app.module.ts`

Add the import and register it in the `imports` array (alongside `ThrottlerModule.forRoot(...)`, currently lines 19–25):

```typescript
import { EventEmitterModule } from "@nestjs/event-emitter";
// ...
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    EventEmitterModule.forRoot(),
    // Public-facing endpoints only (auth, portal, webhooks) sit behind this —
    // see docs/architecture/05-auth-and-security.md ("Rate limiting").
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    HealthModule,
    IdentityModule,
    CustomersModule,
    TicketsModule,
  ],
```

`EventEmitterModule.forRoot()` with no options — no wildcard listeners, no max-listener overrides, nothing beyond the library's defaults, since nothing in this story's scope needs them.

### 3 — Event contract file

Create `apps/api/src/modules/tickets/tickets.events.ts` exactly as specified in "Event payload contract" above.

### 4 — Emit from `TicketsService`

File: `apps/api/src/modules/tickets/tickets.service.ts`

Inject `EventEmitter2` alongside the existing `PrismaService`/`TenantContext`:

```typescript
import { Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { TicketPriority, TicketStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "../../common/tenant/tenant-context";
import type { CreateTicketDto } from "./dto/create-ticket.dto";
import type { UpdateTicketDto } from "./dto/update-ticket.dto";
import { TICKET_CREATED_EVENT, TICKET_UPDATED_EVENT } from "./tickets.events";
import type { TicketCreatedEvent, TicketUpdatedEvent } from "./tickets.events";

// ...

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
    private readonly eventEmitter: EventEmitter2,
  ) {}
```

`createTicket` — emit immediately after the existing `create` call succeeds, before `return`:

```typescript
    const ticket = await this.prisma.ticket.create({
      data: {
        branchId,
        customerId: dto.customerId,
        contactId: dto.contactId ?? null,
        departmentId: dto.departmentId ?? null,
        assignedToUserId: dto.assignedToUserId ?? null,
        subject: dto.subject,
        category: dto.category ?? null,
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
      },
    });
    const summary = toTicketSummary(ticket);
    this.eventEmitter.emit(TICKET_CREATED_EVENT, { ticket: summary } satisfies TicketCreatedEvent);
    return summary;
```

`updateTicket` — the current implementation (lines 106–118) discards `prisma.ticket.update`'s return value and returns only `{ id }`. Capture the updated row so the event payload reflects the actual post-write state, but **do not change the method's public return type** — it still returns `{ id }`:

```typescript
  async updateTicket(id: string, dto: UpdateTicketDto): Promise<{ id: string }> {
    const { branchId } = this.tenantContext.requireBranchScope();
    await this.findTicketInScope(id);

    if (dto.assignedToUserId !== undefined) {
      await this.requireUserInScope(dto.assignedToUserId, branchId);
    }

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: {
        ...(dto.subject !== undefined ? { subject: dto.subject } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.assignedToUserId !== undefined
          ? { assignedToUserId: dto.assignedToUserId }
          : {}),
      },
    });
    this.eventEmitter.emit(TICKET_UPDATED_EVENT, {
      ticket: toTicketSummary(updated),
    } satisfies TicketUpdatedEvent);
    return { id };
  }
```

No other method (`listTickets`, `getTicket`) emits anything — reads never emit domain events, only writes do, and only the two writes named in Settled decisions 4–5.

### 5 — `TicketsModule` — no change needed

`EventEmitter2` is provided globally by `EventEmitterModule.forRoot()` (Task 2), so `apps/api/src/modules/tickets/tickets.module.ts` needs no edit — `TicketsService` can inject `EventEmitter2` the same way it already injects `TenantContext`, without `TicketsModule`'s own `providers`/`imports` arrays changing.

---

## Edge Cases & Failure Modes

- **A cross-domain check fails (unknown/out-of-scope customer, contact, department, or assignee) on create, or an unknown/out-of-scope ticket or assignee on update:** no event fires — the existing `NotFoundException` throws before either emission line is reached, exactly as described in "Emission timing and failure behavior" above.
- **The Prisma write itself fails** (a genuine database error, not a pre-checked scoping failure): no event fires; the exception propagates unchanged, and the HTTP response is whatever it already was before this story (a `500`, or whatever NestJS's exception filter maps a raw Prisma error to today — this story does not change that mapping).
- **A future listener throws synchronously inside `emit()`:** with zero listeners registered in this story, this cannot happen yet. Documented here as a known forward-looking risk: the first story to add a real subscriber (e.g., `SlaModule` reacting to `ticket.created`) should decide whether `TicketsService`'s emission call needs a `try/catch` (so a buggy listener can never turn a successful ticket write into a failed HTTP response) — that decision is explicitly out of this story's scope because there is nothing to test against today.
- **`updateTicket` is called with an empty (all-fields-omitted) `UpdateTicketDto`:** the existing behavior (an update with an empty `data: {}`, which Postgres still executes and which bumps `updatedAt` via the `@updatedAt` directive) is unchanged by this story. `ticket.updated` still fires — this story does not add "did anything actually change" detection; that would be new scope beyond "emit after successful persistence."
- **Two events with an identical payload shape (`TicketCreatedEvent`/`TicketUpdatedEvent`):** intentional, not a mistake — see "Event payload contract" for why they're still declared as two distinct interfaces.

---

## Test Plan

### Unit tests (extend the existing file — no new file)

File: `apps/api/src/modules/tickets/tickets.service.spec.ts`

Add a `buildEventEmitterMock()` helper (`{ emit: vi.fn() }`) alongside the existing `buildPrismaMock`/`buildTenantContextMock`, and pass it as `TicketsService`'s third constructor argument in `createService`. Add these cases (do not modify any existing `it` block — all 13 current tests must still pass unmodified):

- `createTicket`, success path: `eventEmitter.emit` is called exactly once, with `TICKET_CREATED_EVENT` and a payload whose `ticket` matches the method's own return value.
- `createTicket`, each existing rejection path (customer/contact/department/assignee not found — the four `it` blocks already in this file): assert `eventEmitter.emit` was **not** called, in addition to the existing assertions on `prisma.ticket.create`.
- `updateTicket`, success path (both the "only includes present fields" case and the "reassigns successfully" case already in this file): assert `eventEmitter.emit` is called exactly once with `TICKET_UPDATED_EVENT` and a `ticket` payload reflecting the mocked `prisma.ticket.update` resolved value.
- `updateTicket`, each existing rejection path (unknown ticket id, reassignment target outside branch): assert `eventEmitter.emit` was **not** called.

### E2E verification — is it justified?

**Yes, but narrowly.** A black-box HTTP test cannot observe an in-process event with no listener — nothing about the response body or status code changes when `emit()` is added, so asserting against the HTTP surface alone would prove nothing beyond "the existing create/update tests still return 200/201," which is already covered by re-running `tickets.e2e-spec.ts` unmodified as a regression check.

What a black-box test *cannot* catch, and what the unit tests above *also* cannot catch (they mock `EventEmitter2`, so they only prove `TicketsService`'s own code calls `.emit()` — they cannot prove `EventEmitterModule.forRoot()` is actually registered, or that DI actually resolves a real `EventEmitter2` into `TicketsService` in the real, fully-wired `AppModule`): a **wiring** mistake — forgetting to register `EventEmitterModule`, or a provider-scope error that leaves `TicketsService` without a working `EventEmitter2`. That specific risk is exactly what this story introduces, so a small, targeted addition to the existing `apps/api/test/tickets.e2e-spec.ts` is justified — not a new file, not new scenarios about tickets themselves, only proof that the real event pipe is connected:

Add, near the top of the `describe` block (after `app.init()` in `beforeAll`), code that grabs the real `EventEmitter2` from the compiled module and records events:

```typescript
import { EventEmitter2 } from "@nestjs/event-emitter";
// ...
let eventEmitter: EventEmitter2;
const createdEvents: unknown[] = [];
const updatedEvents: unknown[] = [];

// inside beforeAll, after `await app.init();`:
eventEmitter = moduleRef.get(EventEmitter2);
eventEmitter.on("ticket.created", (payload) => createdEvents.push(payload));
eventEmitter.on("ticket.updated", (payload) => updatedEvents.push(payload));
```

Then, immediately after the existing "creates a ticket..." `it` block, add one assertion (not a new `it` — appended to the same test, since it's checking the side effect of the same action already being tested) that `createdEvents` grew by one and its `ticket.id` matches the response body's `id`; and similarly after the existing "updates status and priority" `it` block, that `updatedEvents` grew by one with the new `status`/`priority`. No other existing `it` block in the file is modified.

This is deliberately the smallest possible e2e footprint that proves the wiring is real, without inventing new ticket-domain scenarios this story has no reason to add.

---

## Verification Steps

1. **Install:** `pnpm install` after Task 1 — confirms `@nestjs/event-emitter` resolves and installs cleanly against the existing `@nestjs/common`/`@nestjs/core` versions.
2. **Backend builds:** `pnpm --filter @crm/api typecheck`, `pnpm --filter @crm/api lint`, `pnpm --filter @crm/api build`.
3. **Workspace builds:** `pnpm typecheck`, `pnpm lint`, `pnpm build` — confirm zero regressions in `apps/web`/`apps/portal`/`apps/worker`/`packages/*` (none of them import anything from `tickets/`).
4. **Unit tests:** `pnpm --filter @crm/api test` — all 51 existing tests plus the new emission-assertion cases in `tickets.service.spec.ts` must pass.
5. **Regression, no live infra needed for this part:** confirm no other `*.spec.ts` file was touched.
6. **Live migration/seed:** **not applicable** — this story adds no Prisma schema change and no migration. Confirm via `git status`/`git diff` that `apps/api/prisma/schema.prisma` and `apps/api/prisma/migrations/` are untouched.
7. **Integration tests:** `pnpm --filter @crm/api test:e2e` against real Postgres/Redis (local `docker-compose`, using the documented `5433` temporary-port fallback if the native Postgres 18 service is again occupying `5432` — revert both `docker-compose.yml` and `apps/api/.env` afterward, exactly as Stories 06–07 did) — all existing `identity`/`customers`/`tickets` e2e scenarios plus the two new event-wiring assertions must pass.
8. **CI:** no `.github/workflows/ci.yml` changes needed. Confirm via `gh run list --workflow=ci.yml --limit 5` if `gh` is reachable from the implementing environment; otherwise report CI verification as explicitly pending — never assumed, per the established precedent from Stories 05–07.

## Done Criteria

- [ ] `@nestjs/event-emitter` is a dependency of `apps/api`; `EventEmitterModule.forRoot()` is registered in `app.module.ts` with no options.
- [ ] `apps/api/src/modules/tickets/tickets.events.ts` exists with `TICKET_CREATED_EVENT`/`TICKET_UPDATED_EVENT` constants and `TicketCreatedEvent`/`TicketUpdatedEvent` interfaces, each wrapping a `TicketSummary`.
- [ ] `TicketsService.createTicket` emits `ticket.created` exactly once, only after `prisma.ticket.create` succeeds; no rejection path (customer/contact/department/assignee not found) emits it.
- [ ] `TicketsService.updateTicket` emits `ticket.updated` exactly once, only after `prisma.ticket.update` succeeds, using the actual post-update row; no rejection path (unknown ticket, unknown reassignment target) emits it. The method's public return type (`{ id }`) is unchanged.
- [ ] No subscriber, no `SlaModule`/`NotificationsModule`/`ChannelsModule`/`AiModule`/`PortalModule`, no CASL, no ticket history/timeline, no `ticket.escalated`, and no `Ticket.externalRef` were introduced.
- [ ] No Prisma schema or migration changes.
- [ ] `.squad/config.yaml` is untouched.
- [ ] Unit tests cover both emission-success cases and every existing rejection path's non-emission, without modifying any pre-existing test's assertions.
- [ ] The two targeted e2e wiring assertions (real `EventEmitter2` from DI actually fires) pass, appended to the two relevant existing `it` blocks in `tickets.e2e-spec.ts`, with no other test in that file changed.
- [ ] Full existing lint/typecheck/build/test suite (Identity & Access + Customer Management + Ticketing) still passes with no regressions.

---

**STOP HERE. Report to the user and wait for confirmation before implementing.**
