# Story 15 — SLA Timer Detection Foundation

## Prerequisites

- `project-foundation` Story 02: `apps/worker`'s BullMQ/Redis foundation — `apps/worker/src/worker.module.ts` (`BullModule.forRootAsync`, `BullModule.registerQueue({ name: HEALTH_CHECK_QUEUE })`), `apps/worker/src/queues/health.processor.ts` (`HEALTH_CHECK_QUEUE = "health-check"`), `apps/worker/src/main.ts` (`NestFactory.createApplicationContext`, no HTTP). All reused, none modified.
- `sla-policy-foundation` Story 11: `SlaTicketTarget` (`responseTargetAt`/`resolutionTargetAt`, computed once, never recomputed) and `SlaTargetListener`'s catch-and-log pattern.
- `sla-policy-foundation` Stories 12–13: `BusinessHoursCalendar`/`addBusinessMinutes` — **not** touched by this story; targets are read as already-computed absolute timestamps only.
- `background-job-producer-foundation` Story 14: `apps/api/src/queues/queues.module.ts` (`BullModule.forRootAsync` via `REDIS_URL`, `BullModule.registerQueue({ name: HEALTH_CHECK_QUEUE })`) and `apps/api/src/queues/health-check.producer.ts` (`HealthCheckProducer`, the "duplicate the queue-name literal across apps, cross-reference in a comment" convention this story continues). Both reused, neither modified.
- A roadmap recon performed after Story 14 identified the cross-process tension this story resolves (`apps/worker` has no Prisma access or event bus; `EventEmitter2` is `apps/api`-only) and recommended the narrow BullMQ hand-back bridge this story implements. The intake this plan was generated from settles every open decision that recon raised — see "Settled decisions" below.

---

## Settled decisions (binding for this story — confirmed by the user, not reopened)

1. **Detection runs in `apps/worker`**, reached via the existing BullMQ-consumer convention; domain events are still emitted only from inside `apps/api`, via a dedicated hand-back queue — not a generic cross-process event bus.
2. **Scheduling:** `Queue.upsertJobScheduler` (the current, non-deprecated BullMQ API — confirmed present on the installed `bullmq@6.2.0`), a fixed 60-second interval, named constant.
3. **At-risk:** begins at the start of the final 20% of the policy's configured minute count (`SlaPolicy.responseTargetMinutes`/`resolutionTargetMinutes` — **not** the actual elapsed span to `targetAt`, which can differ once business hours stretch it), and only while `now < targetAt`.
4. **Breach:** `now >= targetAt`.
5. **Direct not-at-risk → breached transitions emit only `sla.breached`** — never a retroactive `sla.at_risk`.
6. **Both are fire-once transitions**, persisted (not in-memory) on `SlaTicketTarget` via new nullable bookkeeping columns — a migration is required. This does not reopen Story 11: the four existing timestamp columns remain untouched; only new columns are added.
7. **Closed/resolved tickets are excluded** via the existing `TicketStatus` enum (`RESOLVED`, `CLOSED`) — no new status.
8. **No `TenantContext` in the worker** — a global, cross-branch sweep is correct and intentional; each emitted event carries `ticketId`/`branchId` so downstream consumers scope themselves.
9. **Event payloads** carry at minimum `ticketId`, `branchId`, `targetType` (`"response" | "resolution"`), `targetAt`.

---

## Story Goal

Give the SLA feature its first real runtime automation: a 60-second BullMQ scheduler in `apps/api` triggers a detection job that runs in `apps/worker`; the worker reads `SlaTicketTarget` rows (joined with `Ticket` and `SlaPolicy`) still relevant to SLA monitoring, determines at-risk/breach transitions against the already-computed absolute target timestamps, persists fire-once state, and hands a typed job back to `apps/api` over a second, dedicated queue; `apps/api` translates that job into the existing `EventEmitter2` mechanism as `sla.at_risk`/`sla.breached`.

**Not in scope:** anything that *reacts* to `sla.at_risk`/`sla.breached` beyond emitting them (Notifications, escalation, AutomationRule); `ticket.recategorized`/SLA target recomputation (a future story); any change to `apps/api/src/modules/tickets/**`; any change to `BusinessHoursCalendar`/`addBusinessMinutes`/the `health-check` queue or its processor; a generic multi-queue producer/consumer framework; a new public HTTP endpoint; a new `Ticket` status; CASL; observability instrumentation.

---

## Context — Read These Files First

1. `apps/worker/src/worker.module.ts` (22 lines, read in full), `apps/worker/src/queues/health.processor.ts` (22 lines, read in full), `apps/worker/src/main.ts` (17 lines, read in full) — the entire current contents of `apps/worker/src` (confirmed via directory listing — exactly 4 files exist today: these three plus `env.validation.ts`). The exact shape this story's new worker-side files extend.
2. `apps/worker/src/env.validation.ts` (26 lines, read in full) — currently validates only `NODE_ENV`/`REDIS_URL` (lines 9-12); its own doc comment (lines 4-7) already names `sla-timers` as one of the "domain queues" a future story would add. `apps/worker/.env` (2 lines, read in full: `NODE_ENV`, `REDIS_URL` — **no `DATABASE_URL`**).
3. `apps/api/src/prisma/prisma.service.ts` (25 lines, read in full) and `apps/api/src/prisma/prisma.module.ts` (15 lines, read in full) — the exact minimal shape (`PrismaClient` subclass with `OnModuleInit`/`OnModuleDestroy`, wrapped in a `@Global()` module) this story mirrors into `apps/worker`, unchanged in substance.
4. `apps/api/package.json` — `"@prisma/client": "6.19.3"` (exact-pinned, no caret, matching `"prisma": "6.19.3"` devDependency) and `DATABASE_URL` in `apps/api/.env`: `postgresql://crm:crm_dev_password@localhost:5432/crm?schema=public` — the exact value `apps/worker/.env` gains (same Postgres instance, same credentials; there is only one Postgres database in this system).
5. `apps/api/src/queues/queues.module.ts` (28 lines, read in full) and `apps/api/src/queues/health-check.producer.ts` (36 lines, read in full) — Story 14's exact shape (one `forRootAsync`, one `registerQueue` per queue, a narrow single-method producer per queue, the queue-name-literal-duplicated-with-a-cross-reference-comment convention) this story extends and continues, without touching either file's existing content beyond adding to `queues.module.ts`'s `imports`/`providers`/`exports` arrays.
6. `apps/api/prisma/schema.prisma` — `SlaTicketTarget` (lines 354-366: `id`, `ticketId` `@unique`, `slaPolicyId`, `responseTargetAt`, `resolutionTargetAt`, `createdAt` — no status/bookkeeping field of any kind today), `SlaPolicy` (lines 320-338: `responseTargetMinutes`, `resolutionTargetMinutes`), `Ticket.status` (line 271: `TicketStatus @default(OPEN)`), `TicketStatus` enum (lines 247-253: `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`).
7. `apps/api/src/modules/tickets/tickets.events.ts` (17 lines, read in full) — the exact precedent this story's own `sla-detection.events.ts` mirrors: event-name constants plus payload interfaces, owned by the domain module (Ticketing owns `tickets.events.ts`; SLA owns its own equivalent), not a generic "events" folder.
8. `apps/api/src/modules/tickets/tickets.service.ts` lines 49-55 — `EventEmitter2` injected directly into a constructor with no module-level import of `EventEmitterModule` (it is registered once, globally, in `apps/api/src/app.module.ts`'s `EventEmitterModule.forRoot()`) — confirms this story's new bridge processor can inject `EventEmitter2` the same way, with no change to `app.module.ts` needed for that specific piece.
9. `apps/api/src/modules/sla-policies/business-hours-calculator.ts` (Story 13) — cited only as the precedent for **extracting a pure, dependency-free function specifically so it can be unit-tested exhaustively without mocking Prisma**. This story's own transition logic (`evaluateTransition`) follows the identical reasoning.
10. `apps/api/vitest.config.mts` (read in full: `include: ["src/**/*.spec.ts", "test/**/*.e2e-spec.ts"]`, `testTimeout`/`hookTimeout: 15_000`) — **no equivalent file exists in `apps/worker`** (confirmed: no `vitest.config.mts` anywhere under `apps/worker`), even though `vitest`/`@nestjs/testing` are already `apps/worker` devDependencies and its `test` script is `vitest run --passWithNoTests`. This story is the first to give `apps/worker` any test files at all, and must add this config file.
11. `apps/api/prisma/migrations/20260826123559_add_sla_ticket_targets/migration.sql` (read in full) — the exact additive-migration shape (one `CREATE TABLE`, one unique index, two FKs) most recently exercised for this same table; this story's migration only adds columns, an even smaller shape.
12. `docs/architecture/06-communication-and-realtime.md` line 24 and `docs/architecture/07-sla-automation-and-ai.md` line 9 — the entire architecture text this story implements against (verified during recon to be the complete wording; nothing else exists anywhere in the docs about `sla-timers` semantics).

---

## Implementation Tasks

### 1 — Schema: fire-once bookkeeping columns

File: `apps/api/prisma/schema.prisma`

Add four nullable columns to the existing `SlaTicketTarget` model (after `createdAt`, before the closing brace, current lines 362-365):

```prisma
  responseAtRiskNotifiedAt    DateTime? @map("response_at_risk_notified_at")
  responseBreachedNotifiedAt  DateTime? @map("response_breached_notified_at")
  resolutionAtRiskNotifiedAt  DateTime? @map("resolution_at_risk_notified_at")
  resolutionBreachedNotifiedAt DateTime? @map("resolution_breached_notified_at")
```

Update the model's own doc comment (lines 340-353) to note that these four columns are the one deliberate exception to "never mutated" — bookkeeping only, never touching `responseTargetAt`/`resolutionTargetAt`/`slaPolicyId`.

Run `pnpm --filter @crm/api prisma:validate`, then generate the migration (Task 8) before writing any code that depends on the new columns' generated TypeScript types.

No index is added for these columns in this story — row counts are not evidenced anywhere as a concern, and no other story has added a "just in case" performance index without a measured need; revisit only if a future story demonstrates it matters.

### 2 — SLA-owned event contract (`apps/api`)

Create file: `apps/api/src/modules/sla-policies/sla-detection.events.ts`

```typescript
export const SLA_AT_RISK_EVENT = "sla.at_risk";
export const SLA_BREACHED_EVENT = "sla.breached";

export type SlaTargetType = "response" | "resolution";

interface SlaDetectionEventBase {
  ticketId: string;
  branchId: string;
  targetType: SlaTargetType;
  targetAt: Date;
}

/** Emitted when a target enters the final 20% of its configured SLA duration, still before targetAt. */
export interface SlaAtRiskEvent extends SlaDetectionEventBase {}

/** Emitted once `now >= targetAt`. */
export interface SlaBreachedEvent extends SlaDetectionEventBase {}
```

Mirrors `tickets.events.ts`'s exact shape (constants + payload interfaces, owned by the domain module) — SLA's own event home, not a generic events folder.

### 3 — Hand-back job payload + bridge processor (`apps/api`)

Create file: `apps/api/src/queues/sla-timer-events-bridge.processor.ts`

```typescript
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { Job } from "bullmq";
import {
  SLA_AT_RISK_EVENT,
  SLA_BREACHED_EVENT,
  type SlaAtRiskEvent,
  type SlaBreachedEvent,
  type SlaTargetType,
} from "../modules/sla-policies/sla-detection.events";

/**
 * The dedicated worker-to-api SLA hand-back queue — apps/worker's
 * `SlaTimerProcessor` (apps/worker/src/queues/sla-timer.processor.ts) is
 * this queue's producer and duplicates this literal with a cross-reference
 * comment, the same convention Story 14 established for
 * `HEALTH_CHECK_QUEUE`. Not a generic event bus — this queue carries only
 * SLA detection results.
 */
export const SLA_TIMER_EVENTS_QUEUE = "sla-timer-events";

/**
 * The only shape a job on `SLA_TIMER_EVENTS_QUEUE` ever takes.
 * `targetAt` is an ISO string here (BullMQ job data is JSON — a `Date`
 * would not survive the round trip); the corresponding `SlaAtRiskEvent`/
 * `SlaBreachedEvent` this processor emits carries a real `Date` instead.
 */
export interface SlaDetectionJobPayload {
  eventType: typeof SLA_AT_RISK_EVENT | typeof SLA_BREACHED_EVENT;
  ticketId: string;
  branchId: string;
  targetType: SlaTargetType;
  targetAt: string;
}

/**
 * The API-side half of Story 15's narrow hand-back bridge — the only
 * `apps/api` BullMQ consumer that exists so far (Story 14 only ever gave
 * `apps/api` producer capability). Translates one typed job into exactly
 * one `EventEmitter2.emit(...)` call. No notification/escalation business
 * behavior — a future story reacts to the emitted events, this class only
 * relays them.
 */
@Injectable()
@Processor(SLA_TIMER_EVENTS_QUEUE)
export class SlaTimerEventsBridgeProcessor extends WorkerHost {
  private readonly logger = new Logger(SlaTimerEventsBridgeProcessor.name);

  constructor(private readonly eventEmitter: EventEmitter2) {
    super();
  }

  async process(job: Job<SlaDetectionJobPayload>): Promise<void> {
    const payload: SlaAtRiskEvent | SlaBreachedEvent = {
      ticketId: job.data.ticketId,
      branchId: job.data.branchId,
      targetType: job.data.targetType,
      targetAt: new Date(job.data.targetAt),
    };

    if (job.data.eventType === SLA_AT_RISK_EVENT) {
      this.eventEmitter.emit(SLA_AT_RISK_EVENT, payload);
    } else {
      this.eventEmitter.emit(SLA_BREACHED_EVENT, payload);
    }
    this.logger.log(`Emitted ${job.data.eventType} for ticket ${job.data.ticketId}`);
  }
}
```

No runtime payload validation (e.g. `class-validator`) is added — this job payload is an internal, same-codebase contract, never user input; no existing BullMQ processor in this codebase (`HealthProcessor`) validates its job data either, and this story does not introduce a new convention for it.

### 4 — `SlaTimersProducer` (`apps/api`)

Create file: `apps/api/src/queues/sla-timers.producer.ts`

```typescript
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";

/**
 * Must stay identical to `SLA_TIMERS_QUEUE` in
 * apps/worker/src/queues/sla-timer.processor.ts — no cross-app
 * shared-constants mechanism exists in this repository (see Story 14's
 * precedent for `HEALTH_CHECK_QUEUE`), so this is a deliberately
 * duplicated literal, not an import.
 */
export const SLA_TIMERS_QUEUE = "sla-timers";

const SLA_TIMER_SCHEDULER_ID = "sla-timers-scheduler";
const SLA_TIMER_INTERVAL_MS = 60_000;

/**
 * Registers the recurring `sla-timers` scheduler on module init, using
 * BullMQ's current Job Scheduler API (`upsertJobScheduler`) — not the
 * deprecated direct-repeatable-job pattern. `upsertJobScheduler` is
 * idempotent by construction: calling it again with the same
 * `SLA_TIMER_SCHEDULER_ID` and the same repeat options updates the
 * existing scheduler rather than creating a second one, so no additional
 * duplicate-prevention logic is needed here — this is what "idempotent
 * scheduler registration" means for this API, verified against the
 * installed `bullmq@6.2.0` type declarations before writing this plan.
 */
@Injectable()
export class SlaTimersProducer implements OnModuleInit {
  private readonly logger = new Logger(SlaTimersProducer.name);

  constructor(@InjectQueue(SLA_TIMERS_QUEUE) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(SLA_TIMER_SCHEDULER_ID, { every: SLA_TIMER_INTERVAL_MS }, { name: "check" });
    this.logger.log(`Registered sla-timers scheduler (every ${SLA_TIMER_INTERVAL_MS}ms)`);
  }
}
```

### 5 — Wire both new queues into `QueuesModule`

File: `apps/api/src/queues/queues.module.ts`

Replace in full:

```typescript
import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import type { EnvConfig } from "../common/config/env.validation";
import { HealthCheckProducer, HEALTH_CHECK_QUEUE } from "./health-check.producer";
import { SlaTimersProducer, SLA_TIMERS_QUEUE } from "./sla-timers.producer";
import { SlaTimerEventsBridgeProcessor, SLA_TIMER_EVENTS_QUEUE } from "./sla-timer-events-bridge.processor";

/**
 * Owns `apps/api`'s BullMQ producer connection — one place all of
 * `apps/api`'s queue registrations live (Story 14's own convention).
 * `health-check` is unchanged. `sla-timers` (produced here, consumed by
 * `apps/worker`) and `sla-timer-events` (consumed here, produced by
 * `apps/worker`) are Story 15's narrow SLA hand-back bridge.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig, true>) => ({
        connection: { url: config.get("REDIS_URL", { infer: true }) },
      }),
    }),
    BullModule.registerQueue({ name: HEALTH_CHECK_QUEUE }),
    BullModule.registerQueue({ name: SLA_TIMERS_QUEUE }),
    BullModule.registerQueue({ name: SLA_TIMER_EVENTS_QUEUE }),
  ],
  providers: [HealthCheckProducer, SlaTimersProducer, SlaTimerEventsBridgeProcessor],
  exports: [HealthCheckProducer, SlaTimersProducer],
})
export class QueuesModule {}
```

### 6 — `apps/worker` Prisma access (minimal)

Create file: `apps/worker/src/prisma/prisma.service.ts` — identical in substance to `apps/api/src/prisma/prisma.service.ts` (Context item 3):

```typescript
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/**
 * Thin wrapper around the generated Prisma client — the minimum needed for
 * `apps/worker` to query `SlaTicketTarget`/`Ticket`/`SlaPolicy`. Mirrors
 * `apps/api/src/prisma/prisma.service.ts` exactly; there is only one
 * Prisma schema in this repository (`apps/api/prisma/schema.prisma`), so
 * `apps/worker` shares the same generated client, not a second one.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log("Connected to Postgres");
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

Create file: `apps/worker/src/prisma/prisma.module.ts` — identical in substance to `apps/api/src/prisma/prisma.module.ts` (Context item 3):

```typescript
import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

File: `apps/worker/package.json` — add to `dependencies`, matching `apps/api`'s exact pin:

```json
    "@prisma/client": "6.19.3",
```

File: `apps/worker/src/env.validation.ts` — add `DATABASE_URL` alongside the existing `REDIS_URL` (current lines 9-12):

```typescript
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
});
```

Update the file's own doc comment (currently: "`apps/worker` only needs Redis (BullMQ) in this foundation story...") to note Postgres access now exists too, for the SLA timer detection Story 15 added.

File: `apps/worker/.env` — add, matching `apps/api/.env`'s exact value (same Postgres instance):

```
DATABASE_URL="postgresql://crm:crm_dev_password@localhost:5432/crm?schema=public"
```

### 7 — Pure transition-evaluation function (`apps/worker`)

Create file: `apps/worker/src/queues/sla-transition-evaluator.ts`

```typescript
const MINUTE_MS = 60_000;
const AT_RISK_FRACTION = 0.2;

export type SlaTransition = "breach" | "at_risk" | "none";

export interface EvaluateTransitionInput {
  now: Date;
  targetAt: Date;
  targetMinutes: number;
  alreadyAtRiskNotified: boolean;
  alreadyBreachedNotified: boolean;
}

/**
 * Pure, dependency-free — no Prisma, no BullMQ — so it can be unit-tested
 * exhaustively without mocking anything, the same reasoning
 * apps/api/src/modules/sla-policies/business-hours-calculator.ts (Story
 * 13) already established for this codebase's other pure-function
 * extraction. Does not read or recompute business hours — `targetAt` is
 * taken as an already-resolved absolute instant.
 *
 * Breach is checked before at-risk on every call: once `now >= targetAt`,
 * this always returns "breach" (or "none" if already notified),
 * regardless of the at-risk threshold or its own notified state — this is
 * what guarantees a direct not-at-risk -> breached transition emits only
 * `sla.breached`, never a retroactive `sla.at_risk` (Settled decision 5).
 */
export function evaluateTransition(input: EvaluateTransitionInput): SlaTransition {
  if (!input.alreadyBreachedNotified && input.now.getTime() >= input.targetAt.getTime()) {
    return "breach";
  }
  if (!input.alreadyBreachedNotified && !input.alreadyAtRiskNotified) {
    const atRiskThresholdMs = input.targetAt.getTime() - input.targetMinutes * MINUTE_MS * AT_RISK_FRACTION;
    if (input.now.getTime() >= atRiskThresholdMs) {
      return "at_risk";
    }
  }
  return "none";
}
```

### 8 — Hand-back job payload duplicate + `SlaTimerProcessor` (`apps/worker`)

Create file: `apps/worker/src/queues/sla-timer-events.types.ts`

```typescript
/**
 * Must stay identical to the corresponding declarations in
 * apps/api/src/queues/sla-timer-events-bridge.processor.ts — no cross-app
 * shared-constants/types mechanism exists in this repository (see Story
 * 14's precedent for `HEALTH_CHECK_QUEUE`), so these are deliberately
 * duplicated, not imported.
 */
export const SLA_TIMER_EVENTS_QUEUE = "sla-timer-events";
export const SLA_AT_RISK_EVENT = "sla.at_risk";
export const SLA_BREACHED_EVENT = "sla.breached";

export type SlaTargetType = "response" | "resolution";

export interface SlaDetectionJobPayload {
  eventType: typeof SLA_AT_RISK_EVENT | typeof SLA_BREACHED_EVENT;
  ticketId: string;
  branchId: string;
  targetType: SlaTargetType;
  targetAt: string;
}
```

Create file: `apps/worker/src/queues/sla-timer.processor.ts`

```typescript
import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import type { Job, Queue } from "bullmq";
import { PrismaService } from "../prisma/prisma.service";
import { evaluateTransition } from "./sla-transition-evaluator";
import {
  SLA_AT_RISK_EVENT,
  SLA_BREACHED_EVENT,
  SLA_TIMER_EVENTS_QUEUE,
  type SlaDetectionJobPayload,
  type SlaTargetType,
} from "./sla-timer-events.types";

/**
 * Must stay identical to `SLA_TIMERS_QUEUE` in
 * apps/api/src/queues/sla-timers.producer.ts.
 */
export const SLA_TIMERS_QUEUE = "sla-timers";

const RELEVANT_TICKET_STATUSES = ["OPEN", "IN_PROGRESS"] as const;

/**
 * `apps/worker`'s half of Story 15's SLA timer detection. Never uses
 * `TenantContext` (structurally unavailable outside an HTTP request; see
 * this story's Settled decision 8) — a global, cross-branch sweep is
 * correct here. Never recomputes or modifies `responseTargetAt`/
 * `resolutionTargetAt` — reads them only, as already-resolved absolute
 * instants (Settled decision 3/no business-hours recalculation).
 */
@Injectable()
@Processor(SLA_TIMERS_QUEUE)
export class SlaTimerProcessor extends WorkerHost {
  private readonly logger = new Logger(SlaTimerProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(SLA_TIMER_EVENTS_QUEUE) private readonly handbackQueue: Queue<SlaDetectionJobPayload>,
  ) {
    super();
  }

  async process(_job: Job): Promise<void> {
    const now = new Date();

    const candidates = await this.prisma.slaTicketTarget.findMany({
      where: {
        OR: [{ responseBreachedNotifiedAt: null }, { resolutionBreachedNotifiedAt: null }],
        ticket: { status: { in: RELEVANT_TICKET_STATUSES } },
      },
      select: {
        id: true,
        responseTargetAt: true,
        resolutionTargetAt: true,
        responseAtRiskNotifiedAt: true,
        responseBreachedNotifiedAt: true,
        resolutionAtRiskNotifiedAt: true,
        resolutionBreachedNotifiedAt: true,
        ticket: { select: { id: true, branchId: true } },
        slaPolicy: { select: { responseTargetMinutes: true, resolutionTargetMinutes: true } },
      },
    });

    for (const target of candidates) {
      await this.evaluateAndFire(target, now, "response", target.slaPolicy.responseTargetMinutes);
      await this.evaluateAndFire(target, now, "resolution", target.slaPolicy.resolutionTargetMinutes);
    }
  }

  private async evaluateAndFire(
    target: {
      id: string;
      responseTargetAt: Date;
      resolutionTargetAt: Date;
      responseAtRiskNotifiedAt: Date | null;
      responseBreachedNotifiedAt: Date | null;
      resolutionAtRiskNotifiedAt: Date | null;
      resolutionBreachedNotifiedAt: Date | null;
      ticket: { id: string; branchId: string };
    },
    now: Date,
    targetType: SlaTargetType,
    targetMinutes: number,
  ): Promise<void> {
    const targetAt = targetType === "response" ? target.responseTargetAt : target.resolutionTargetAt;
    const alreadyAtRiskNotified =
      targetType === "response" ? target.responseAtRiskNotifiedAt !== null : target.resolutionAtRiskNotifiedAt !== null;
    const alreadyBreachedNotified =
      targetType === "response" ? target.responseBreachedNotifiedAt !== null : target.resolutionBreachedNotifiedAt !== null;

    const transition = evaluateTransition({ now, targetAt, targetMinutes, alreadyAtRiskNotified, alreadyBreachedNotified });
    if (transition === "none") {
      return;
    }

    const claimed =
      transition === "breach"
        ? await this.claim(target.id, targetType, "breach", now)
        : await this.claim(target.id, targetType, "at_risk", now);
    if (!claimed) {
      // Another concurrent/overlapping run already claimed this exact
      // transition — do not enqueue a duplicate hand-back job.
      return;
    }

    const payload: SlaDetectionJobPayload = {
      eventType: transition === "breach" ? SLA_BREACHED_EVENT : SLA_AT_RISK_EVENT,
      ticketId: target.ticket.id,
      branchId: target.ticket.branchId,
      targetType,
      targetAt: targetAt.toISOString(),
    };
    await this.handbackQueue.add("sla-detection", payload);
    this.logger.log(`Fired ${payload.eventType} (${targetType}) for ticket ${target.ticket.id}`);
  }

  /**
   * Atomically claims the right to fire one transition for one target via
   * a conditional `updateMany` (`where` includes the "not yet notified"
   * column) — the same instant Postgres commits the update, `count`
   * reports whether *this* call actually changed the row. If a concurrent
   * or overlapping timer run already claimed it first, `count` is 0 and
   * this call must not enqueue a hand-back job. This is what
   * "safe across multiple worker instances" (this story's own requirement)
   * means concretely: BullMQ's own per-job lock only prevents two workers
   * processing the *same* scheduled tick simultaneously, not two
   * *different* overlapping ticks (if one run takes longer than the
   * 60-second interval) from evaluating the same row — this conditional
   * update is what closes that second, real race window.
   *
   * The update is attempted before the hand-back job is enqueued, not
   * after: if the enqueue itself then fails, the transition is marked
   * fired but no job exists — an accepted, documented rare-failure gap
   * (favoring "never duplicate" over "never lose," per this story's own
   * priority) rather than an attempted exactly-once guarantee across two
   * separate systems (Postgres and Redis), which nothing in this story's
   * scope justifies building.
   */
  private async claim(
    targetId: string,
    targetType: SlaTargetType,
    transition: "at_risk" | "breach",
    now: Date,
  ): Promise<boolean> {
    if (targetType === "response" && transition === "at_risk") {
      const result = await this.prisma.slaTicketTarget.updateMany({
        where: { id: targetId, responseAtRiskNotifiedAt: null },
        data: { responseAtRiskNotifiedAt: now },
      });
      return result.count === 1;
    }
    if (targetType === "response" && transition === "breach") {
      const result = await this.prisma.slaTicketTarget.updateMany({
        where: { id: targetId, responseBreachedNotifiedAt: null },
        data: { responseBreachedNotifiedAt: now },
      });
      return result.count === 1;
    }
    if (targetType === "resolution" && transition === "at_risk") {
      const result = await this.prisma.slaTicketTarget.updateMany({
        where: { id: targetId, resolutionAtRiskNotifiedAt: null },
        data: { resolutionAtRiskNotifiedAt: now },
      });
      return result.count === 1;
    }
    const result = await this.prisma.slaTicketTarget.updateMany({
      where: { id: targetId, resolutionBreachedNotifiedAt: null },
      data: { resolutionBreachedNotifiedAt: now },
    });
    return result.count === 1;
  }
}
```

`RELEVANT_TICKET_STATUSES = ["OPEN", "IN_PROGRESS"]` (rather than excluding `["RESOLVED", "CLOSED"]`) is an explicit allow-list of the two `TicketStatus` values that are not resolved/closed — equivalent to the intake's "exclude closed/resolved" requirement, written the way it reads most directly against the enum (Context item 6).

### 9 — Register everything in `WorkerModule`

File: `apps/worker/src/worker.module.ts`

Replace in full:

```typescript
import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { validateEnv, type EnvConfig } from "./env.validation";
import { HealthProcessor, HEALTH_CHECK_QUEUE } from "./queues/health.processor";
import { SlaTimerProcessor, SLA_TIMERS_QUEUE } from "./queues/sla-timer.processor";
import { SLA_TIMER_EVENTS_QUEUE } from "./queues/sla-timer-events.types";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig, true>) => ({
        connection: { url: config.get("REDIS_URL", { infer: true }) },
      }),
    }),
    BullModule.registerQueue({ name: HEALTH_CHECK_QUEUE }),
    BullModule.registerQueue({ name: SLA_TIMERS_QUEUE }),
    BullModule.registerQueue({ name: SLA_TIMER_EVENTS_QUEUE }),
    PrismaModule,
  ],
  providers: [HealthProcessor, SlaTimerProcessor],
})
export class WorkerModule {}
```

### 10 — Test infrastructure for `apps/worker`

Create file: `apps/worker/vitest.config.mts` — mirrors `apps/api/vitest.config.mts` (Context item 10) exactly:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.spec.ts", "test/**/*.e2e-spec.ts"],
    environment: "node",
    globals: false,
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
```

Update `apps/worker/package.json`'s `test` script from `"vitest run --passWithNoTests"` to `"vitest run --exclude \"**/*.e2e-spec.ts\""`, and add a `"test:e2e": "vitest run e2e-spec"` script — mirroring `apps/api/package.json`'s exact script pattern now that `apps/worker` has real tests to separate.

### 11 — Migration

With Docker Postgres up (use the documented temporary `5433:5432` fallback if the native PostgreSQL service is again occupying `5432` — revert both `docker-compose.yml` and `apps/api/.env` immediately after, exactly as Stories 06–14 did), run:

```bash
pnpm --filter @crm/api exec prisma migrate dev --name add_sla_target_notification_state
```

Must generate exactly one migration adding four nullable columns to `sla.sla_ticket_targets` — no `CREATE TABLE`, no new FK, no index. Read the generated `migration.sql` before trusting it.

---

## Edge Cases & Failure Modes

- **Overlapping timer runs** (a run takes longer than 60 seconds, or two worker replicas both pick up ticks close together): the conditional `updateMany` in `claim()` (Task 8) is the actual safety mechanism — BullMQ's own per-job lock only prevents two workers processing the identical scheduled job, not two different ticks evaluating the same row.
- **Enqueue failure after a successful claim:** documented, accepted gap (Task 8's doc comment) — favors never duplicating a fire-once event over never losing one; no outbox pattern is built, since nothing in this story's scope justifies one.
- **A target's ticket becomes `RESOLVED`/`CLOSED` between two ticks:** the next tick's query (`RELEVANT_TICKET_STATUSES` filter) simply stops returning that row — no explicit cleanup needed, no new status introduced.
- **A target already past `targetAt` on the very first tick that ever sees it** (e.g. worker was down for a while): `evaluateTransition` checks breach before at-risk unconditionally, so it correctly fires only `sla.breached`, never a retroactive `sla.at_risk` — this is the same logic path as an in-tick direct transition, not a special case.
- **`SlaPolicy.responseTargetMinutes`/`resolutionTargetMinutes` change after a target was already computed:** irrelevant to this story — `evaluateTransition` uses the `targetMinutes` value read fresh from the *current* `SlaPolicy` row at evaluation time, not a value frozen at target-creation time; the `targetAt` absolute instant itself (Story 11/13) is what stays immutable, not the policy. A later policy edit changes the at-risk threshold's own computation on the very next tick, which is a natural, non-alarming consequence, not a bug.
- **`apps/worker` restarts mid-sweep:** the current `_job` simply fails/is retried per BullMQ's own default job semantics (not overridden by this story); any rows already claimed via `claim()` before the restart keep their notified state and are correctly skipped on retry.
- **The hand-back queue's job is processed by `apps/api`'s bridge processor more than once** (BullMQ's own at-least-once delivery under certain failure/retry conditions): `EventEmitter2.emit()` would fire twice for the same transition in that rare case — an accepted limitation of not adding a second, separate idempotency layer on the `apps/api` consumption side, since the `apps/worker` claim already prevents the *common* duplicate-generation path (repeated ticks), and BullMQ's own delivery redundancy is a materially rarer, already-cross-cutting concern not unique to this story.

---

## Test Plan

1. **Unit — `apps/worker/src/queues/sla-transition-evaluator.spec.ts` (new):** pure-function tests, no mocking. Cover: not yet at-risk (well before threshold); enters at-risk exactly at the threshold; still at-risk but not yet breached; breach at/after `targetAt`; already-at-risk-notified does not re-fire at-risk; already-breached-notified never fires anything; a target that jumps straight from not-at-risk to past-`targetAt` in one tick returns `"breach"`, never `"at_risk"`.
2. **Unit — `apps/worker/src/queues/sla-timer.processor.spec.ts` (new):** hand-built `PrismaService`/`Queue` mocks (mirroring `sla-target.listener.spec.ts`'s pattern). Cover: candidates query shape (status filter, OR-on-not-yet-breached); a claimed transition enqueues exactly one correctly-shaped hand-back job; an unclaimed transition (mocked `updateMany` returning `count: 0`) enqueues nothing; both response and resolution are evaluated independently for the same row.
3. **Unit — `apps/api/src/queues/sla-timers.producer.spec.ts` (new):** mocked `Queue`, asserts `upsertJobScheduler` is called with `SLA_TIMER_SCHEDULER_ID`, `{ every: 60_000 }`.
4. **Unit — `apps/api/src/queues/sla-timer-events-bridge.processor.spec.ts` (new):** mocked `EventEmitter2`, asserts a `sla.at_risk`-typed job emits `SLA_AT_RISK_EVENT` with the correctly-shaped, `Date`-converted payload, and a `sla.breached`-typed job emits `SLA_BREACHED_EVENT`.
5. **Integration — `apps/api/test/sla-timers-producer.e2e-spec.ts` (new):** real Redis, resolves `SlaTimersProducer`'s queue directly from a compiled `TestingModule` (Story 14's own no-HTTP e2e pattern) — after `AppModule` boots, `queue.getJobSchedulers()` shows exactly one scheduler with the expected id/interval; re-initializing the module a second time still shows exactly one (idempotent registration, not two).
6. **Integration — `apps/worker/test/sla-timer.processor.e2e-spec.ts` (new):** real Postgres + Redis. Seeds a real `SlaPolicy`/`Ticket`/`SlaTicketTarget` row with `responseTargetAt` already in the past; resolves `SlaTimerProcessor` from a compiled `WorkerModule` `TestingModule`; calls `.process(fakeJob)` directly (mirroring how `HealthCheckProducer`'s e2e test resolves a provider directly rather than going through a live BullMQ dispatch); asserts the row's `responseBreachedNotifiedAt` is now set and exactly one job landed on the real `sla-timer-events` queue with the expected payload. A second call to `.process()` immediately after must not enqueue a second job (duplicate-prevention). Cleans up the seeded rows and the enqueued job afterward.
7. **Regression — no changes, re-run only:** every existing unit spec and every existing `*.e2e-spec.ts` in `apps/api`, and `apps/worker`'s own `test`/`test:e2e` scripts (previously always empty) now run this story's new files — confirm nothing else regresses.

---

## Migration / Rollback

Additive only: four new nullable columns on `sla.sla_ticket_targets`, no new table, no new constraint beyond the columns themselves. If the migration fails partway, fix and re-run — no existing column, constraint, or data is touched.

---

## Verification Steps

1. **Install:** `pnpm install` at the repository root (`apps/worker`'s new `@prisma/client` dependency).
2. **Prisma:** `pnpm --filter @crm/api prisma:validate`.
3. **Backend builds:** `pnpm --filter @crm/api typecheck`, `lint`, `build`; `pnpm --filter worker typecheck`, `lint`, `build`.
4. **Workspace builds:** `pnpm typecheck`, `pnpm lint`, `pnpm build` at the repository root.
5. **Unit tests:** `pnpm --filter @crm/api test`; `pnpm --filter worker test`.
6. **Live infra:** `docker compose up -d postgres redis` (temporary `5433` fallback if needed, reverted immediately after); `pnpm --filter @crm/api exec prisma migrate dev --name add_sla_target_notification_state`; `pnpm --filter @crm/api prisma:seed` (idempotency check).
7. **Integration tests:** `pnpm --filter @crm/api test:e2e`; `pnpm --filter worker test:e2e`. Run at least twice to confirm no flakiness from the new concurrency/idempotency assertions.
8. **Regression:** confirm the full existing `apps/api` unit + e2e suite is otherwise unaffected, and that `health-check` behavior (Story 02/14) is unchanged.
9. **Hygiene:** `git status`; `git diff --stat -- .squad/config.yaml` (must be empty); confirm `apps/api/src/modules/tickets/**` has an empty diff.
10. **CI:** `gh run list --workflow=ci.yml --limit 5` if `gh` is reachable; otherwise report CI verification as explicitly pending — never assumed.

## Done Criteria

- [ ] `sla-timers` is registered through the existing `QueuesModule`; no second BullMQ connection module exists in `apps/api`.
- [ ] `SlaTimersProducer` registers a 60-second `upsertJobScheduler`-based scheduler, idempotently (re-init does not create a second scheduler).
- [ ] `apps/worker` consumes `sla-timers` via `SlaTimerProcessor`, with only the minimum Prisma wiring added (no domain modules, no business logic beyond detection).
- [ ] At-risk fires at the start of the final 20% of the policy's configured minutes, only before `targetAt`; breach fires at `now >= targetAt`; a direct not-at-risk-to-breached transition emits only `sla.breached`.
- [ ] Both transitions are fire-once, persisted via the four new nullable columns, safe under concurrent/overlapping execution via the conditional-update claim.
- [ ] Closed/resolved tickets are excluded via the existing `TicketStatus` values — no new status.
- [ ] `responseTargetAt`/`resolutionTargetAt` remain untouched; no business-hours recalculation occurs during detection.
- [ ] `TenantContext` is not used anywhere in `apps/worker`.
- [ ] The hand-back job payload and the final `EventEmitter2` payloads both carry `ticketId`, `branchId`, `targetType`, `targetAt`.
- [ ] `apps/api` consumes the dedicated hand-back queue and emits `sla.at_risk`/`sla.breached` via the existing `EventEmitter2` — no generic cross-process event bus.
- [ ] The existing `health-check` queue, `HealthCheckProducer`, and `HealthProcessor` are byte-for-byte unchanged.
- [ ] The migration is additive-only.
- [ ] `.squad/config.yaml` is untouched; `apps/api/src/modules/tickets/**` is untouched.
- [ ] Full existing lint/typecheck/build/test suite (Identity & Access, Customer Management, Ticketing, SLA Policy Foundation, Background Job Producer Foundation) still passes with no regressions.

---

**STOP HERE. Report to the user and wait for confirmation before implementing.**
