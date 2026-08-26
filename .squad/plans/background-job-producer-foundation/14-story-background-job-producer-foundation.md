# Story 14 — Background Job Producer Foundation

## Prerequisites

- `project-foundation` Story 02 completed: the existing `apps/worker` BullMQ/Redis foundation — `apps/worker/src/worker.module.ts` (`BullModule.forRootAsync` connected via `REDIS_URL`, `BullModule.registerQueue({ name: HEALTH_CHECK_QUEUE })`) and `apps/worker/src/queues/health.processor.ts` (`HEALTH_CHECK_QUEUE = "health-check"`, `HealthProcessor`) — both reused, unmodified, by this story.
- `apps/api/src/common/config/env.validation.ts` — `REDIS_URL` is already a required, validated environment variable (line 16), already used today by `apps/api/src/health/health.controller.ts`'s readiness check (a raw `ioredis` `PING`, unrelated to BullMQ). No new environment variable is introduced.
- `sla-policy-foundation` Stories 10–13 completed — no code from that feature is touched by this story; cited only because a roadmap recon performed after Story 13 identified this as the next unblocked cross-cutting increment. See this feature's own [00-overview.md](./00-overview.md) for why this lives in its own feature slug rather than under `sla-policy-foundation`.

---

## Story Goal

Give `apps/api` the ability to enqueue a BullMQ job that reaches Redis and the existing `apps/worker` consumer — nothing more. Today `apps/api` has no BullMQ producer capability at all (confirmed: no `bullmq`/`@nestjs/bullmq` dependency in `apps/api/package.json`); `apps/worker` already has a working BullMQ/Redis connection and consumes exactly one queue, `health-check`, whose own doc comment states it exists solely to prove connectivity. This story adds the missing producer half: a small, single-purpose service in `apps/api` that enqueues a ping-style job onto that **same, existing** `health-check` queue.

**Not in scope:** any real business queue (`sla-timers`, `notifications`, `integration-sync`, `ai-processing`, `reports-refresh`) or any job-processing/business behavior; a generic multi-queue producer abstraction; any new public HTTP endpoint; any change to `apps/worker`; any change to the `health-check` queue's name, processor, or job contract; OpenTelemetry/BullMQ instrumentation; Bull Board; Redis auth/TLS; frontend changes.

---

## Context — Read These Files First

1. `apps/worker/src/worker.module.ts` (22 lines, read in full) — the exact pattern this story's `apps/api` module mirrors: `BullModule.forRootAsync` (lines 10-16, `connection: { url: config.get("REDIS_URL", { infer: true }) }`) and `BullModule.registerQueue({ name: HEALTH_CHECK_QUEUE })` (line 17).
2. `apps/worker/src/queues/health.processor.ts` (22 lines, read in full) — `HEALTH_CHECK_QUEUE = "health-check"` (line 5) and, critically, the exact job payload/return shape the existing consumer expects: `process(job: Job<{ pingedAt: string }>): Promise<{ pongedAt: string }>` (line 18). Any job this story's producer enqueues onto this queue **must** match the `{ pingedAt: string }` data shape, or the existing, unmodified processor would fail to make sense of it (the processor itself is not changed by this story, but the producer's payload must be its correct counterpart). The doc comment (lines 7-12) confirms this queue's sole purpose is proving the Redis/BullMQ connection, and that real queues are added by the feature stories that need them.
3. `apps/api/src/app.module.ts` (50 lines, read in full) — the `imports` array (lines 20-36) and its module-import lines (lines 6-17) — where the new module is registered, immediately after `HealthModule` (line 31), grouping this cross-cutting infra module next to the other one.
4. `apps/api/src/common/config/env.validation.ts` (41 lines, read in full) — `REDIS_URL: z.string().min(1, "REDIS_URL is required")` (line 16) — already present; **no edit to this file**.
5. `apps/api/src/health/health.controller.ts` (52 lines, read in full) — the existing, unrelated `ioredis` `PING` readiness check (lines 35-47). Confirms `apps/api` already depends on Redis being reachable; this story adds a second, independent Redis usage (a managed BullMQ connection) alongside it — the two do not conflict.
6. `apps/api/package.json` (64 lines, read in full) — current `dependencies` (lines 23-45): `ioredis` is present (line 39); `bullmq`/`@nestjs/bullmq` are **not**. `apps/worker/package.json` (38 lines, read in full) — the exact versions to match: `"@nestjs/bullmq": "^11.0.5"` (line 16), `"bullmq": "^6.2.0"` (line 21).
7. `apps/api/src/health/health.module.ts` (8 lines, read in full) — the smallest possible module shape in this codebase (`controllers` only, no providers) — for contrast; this story's new module needs `imports`/`providers`/`exports`, not this exact shape, but it is the nearest sibling "infra, not domain" module.
8. `packages/shared/src/index.ts`/`auth.ts`/`jwt.ts` — read via `list_dir`: this package contains only auth/JWT types. Its documented scope (`docs/architecture/01-technology-stack.md`, "Repository shape") is "shared TypeScript types/DTOs/constants used by both frontend apps and the API" — it does not mention `apps/worker`, and there is no existing precedent for an API↔worker shared constant anywhere in this repository. This is why `HEALTH_CHECK_QUEUE` is **duplicated** as a literal in `apps/api` rather than imported from a shared location (Task 1) — introducing a new cross-app shared-constants mechanism for a single string is not justified by any existing pattern.
9. No `apps/api/prisma/schema.prisma` changes are needed — this story is not persistence work.

---

## Implementation Tasks

### 1 — `apps/api` dependencies

File: `apps/api/package.json`

Add to `dependencies` (matching `apps/worker/package.json`'s exact pinned versions):

```json
    "@nestjs/bullmq": "^11.0.5",
    "bullmq": "^6.2.0",
```

Run `pnpm install` at the repository root afterward so the lockfile picks up the new workspace dependency.

### 2 — `HealthCheckProducer`

Create file: `apps/api/src/queues/health-check.producer.ts`

```typescript
import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Job, Queue } from "bullmq";

/**
 * Must stay identical to `HEALTH_CHECK_QUEUE` in
 * apps/worker/src/queues/health.processor.ts — there is no cross-app
 * shared-constants mechanism in this repository (see Story 14's Context
 * item 8), so this is a deliberately duplicated literal, not an import.
 */
export const HEALTH_CHECK_QUEUE = "health-check";

/**
 * The API-side producer counterpart to apps/worker's existing
 * `HealthProcessor` — the first and, for this story, only BullMQ producer
 * in `apps/api`. Deliberately narrow: one queue, one job shape, one method.
 * A generic multi-queue producer abstraction is not introduced here — no
 * second queue exists yet to generalize across (see this story's Story
 * Goal). Real business queues (`sla-timers`, `notifications`,
 * `integration-sync`, `ai-processing`, `reports-refresh`) are added by the
 * feature stories that need them.
 *
 * Not a fire-and-forget event listener like `SlaTargetListener` — `ping()`
 * lets a failure (e.g. a dropped Redis connection) propagate to its caller
 * rather than catching and logging it, since there is no HTTP request this
 * method must protect.
 */
@Injectable()
export class HealthCheckProducer {
  constructor(@InjectQueue(HEALTH_CHECK_QUEUE) private readonly queue: Queue<{ pingedAt: string }>) {}

  async ping(): Promise<Job<{ pingedAt: string }>> {
    return this.queue.add("ping", { pingedAt: new Date().toISOString() });
  }
}
```

### 3 — `QueuesModule`

Create file: `apps/api/src/queues/queues.module.ts`

```typescript
import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import type { EnvConfig } from "../common/config/env.validation";
import { HealthCheckProducer, HEALTH_CHECK_QUEUE } from "./health-check.producer";

/**
 * Owns `apps/api`'s BullMQ producer connection — the API-side counterpart
 * to `apps/worker/src/worker.module.ts`'s `BullModule.forRootAsync`/
 * `BullModule.registerQueue` pair. Registers the **existing** `health-check`
 * queue only; no new queue name is introduced.
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
  ],
  providers: [HealthCheckProducer],
  exports: [HealthCheckProducer],
})
export class QueuesModule {}
```

### 4 — Register `QueuesModule`

File: `apps/api/src/app.module.ts`

Add the import alongside the existing module imports (after line 13, `import { HealthModule } from "./health/health.module";`):

```typescript
import { QueuesModule } from "./queues/queues.module";
```

Add it to the `imports` array, immediately after `HealthModule` (line 31):

```typescript
    HealthModule,
    QueuesModule,
```

No other line in `app.module.ts` changes. `ConfigModule.forRoot({ isGlobal: true, ... })` (lines 21-24) already makes `ConfigService` available to `QueuesModule`'s `useFactory` without a further import.

### 5 — Tests

Create file: `apps/api/src/queues/health-check.producer.spec.ts`

Hand-built mock, no `Test.createTestingModule` — mirrors the pattern already used by e.g. `apps/api/src/modules/sla-policies/sla-target.listener.spec.ts`. Cover:

- `ping()` calls `queue.add("ping", { pingedAt: <ISO string> })` exactly once.
- `ping()` resolves with whatever the (mocked) `queue.add` resolved to.
- `ping()`'s rejection propagates when the mocked `queue.add` rejects (no catch-and-log — see Task 2's doc comment).

Create file: `apps/api/test/health-check-producer.e2e-spec.ts`

Bootstraps the real `AppModule` against real Redis, but — unlike every existing `*.e2e-spec.ts` in this repository — does **not** create an HTTP-listening Nest application or use `supertest`, because this story deliberately introduces no HTTP endpoint. Instead it uses `Test.createTestingModule({ imports: [AppModule] }).compile()` followed by `moduleRef.init()` (not `createNestApplication()`/`app.init()`), then resolves providers directly via `moduleRef.get(...)`. This is a standard NestJS testing technique for exercising a provider with no controller in front of it; call this out explicitly as a deliberate departure from every prior e2e file's HTTP-based shape, not an oversight.

```typescript
import { getQueueToken } from "@nestjs/bullmq";
import { Test } from "@nestjs/testing";
import type { Queue } from "bullmq";
import { AppModule } from "../src/app.module";
import { HealthCheckProducer, HEALTH_CHECK_QUEUE } from "../src/queues/health-check.producer";
```

Cover:

1. Calling `HealthCheckProducer.ping()` returns a `Job` with a defined `id`.
2. Fetching that job back from the real queue (`queue.getJob(job.id)`, via the `Queue` resolved with `getQueueToken(HEALTH_CHECK_QUEUE)`) returns a non-null job whose `data.pingedAt` matches what was enqueued — proving the job actually reached Redis, not just that the mocked call returned something.
3. The test removes the job it created (`await job.remove()`) after its assertions, so this infrastructure self-test does not leave permanently-waiting jobs accumulating in the shared Redis instance across repeated runs (mirroring this repository's established care about not littering shared test infrastructure with unbounded leftover state).
4. `afterAll` closes the module (`await moduleRef.close()`).

This suite does **not** boot `apps/worker` and does not assert that the job is ever processed — per this story's own Done Criteria, proving a successful enqueue against real Redis is the verification bar; a full producer-to-worker round trip is explicitly not required.

---

## Edge Cases & Failure Modes

- **Redis unreachable when `apps/api` boots:** `BullModule.forRootAsync`'s connection follows BullMQ/ioredis's own default retry behavior — no custom retry/backoff is added here, matching `apps/worker/src/worker.module.ts`'s own unmodified precedent, which does not add any either.
- **`queue.add()` rejects (e.g. a dropped connection mid-call):** propagates to the caller uncaught — `HealthCheckProducer.ping()` is not a fire-and-forget event listener like `SlaTargetListener`, so there is no catch-and-log responsibility here (Task 2).
- **`HEALTH_CHECK_QUEUE`'s literal drifting out of sync between `apps/api` and `apps/worker`:** guarded only by the explicit cross-referencing code comments in both files (Task 2; `apps/worker/src/queues/health.processor.ts` line 5) — there is no shared-constant mechanism to enforce this at compile time (Context item 8), and none is introduced.
- **Repeated e2e test runs against the same shared Redis instance:** each run creates and then removes its own job (Task 5, point 3) — no accumulation.
- **A real `apps/worker` process happens to be running locally at the same time as this story's e2e test:** harmless — it would simply process the job (logging it, per the unmodified `HealthProcessor`) before the test's own cleanup call, or the test's `job.remove()` may occasionally race a real worker's own completion-handling; either outcome is benign and not asserted against either way.
- **Version mismatch between `apps/api`'s and `apps/worker`'s `bullmq`/`@nestjs/bullmq`:** avoided by pinning identical versions in Task 1, not left to drift.

---

## Test Plan

1. **Unit — `apps/api/src/queues/health-check.producer.spec.ts` (new):** all cases in Task 5. No Redis dependency (hand-built `Queue` mock).
2. **Integration — `apps/api/test/health-check-producer.e2e-spec.ts` (new):** the 2 scenarios in Task 5, against real Redis (no Postgres dependency, but the suite still runs inside the same `apps/api` `test:e2e` Vitest project as every other e2e file, so it is included in `--no-file-parallelism` sequencing automatically).
3. **Regression — no changes, re-run only:** every existing unit spec and every existing `*.e2e-spec.ts` must still pass unmodified — this story touches no existing test file.

---

## Migration / Rollback

None required. No Prisma schema or model changes.

---

## Verification Steps

1. **Install:** `pnpm install` at the repository root — confirm the lockfile picks up `@nestjs/bullmq`/`bullmq` in `apps/api`.
2. **Backend builds:** `pnpm --filter @crm/api typecheck`, `pnpm --filter @crm/api lint`, `pnpm --filter @crm/api build`.
3. **Workspace builds:** `pnpm typecheck`, `pnpm lint`, `pnpm build` in the repository root — confirm zero regressions in `apps/web`/`apps/portal`/`apps/worker`/`packages/*`.
4. **Unit tests:** `pnpm --filter @crm/api test` — must pass, including the new `health-check.producer.spec.ts`.
5. **Live Redis:** `docker compose up -d redis` (Postgres is not required by this story's own new tests, but keep it up for the regression suite in step 6). Use the documented temporary port-fallback approach only if the native services occupy a needed port — this story does not change that convention.
6. **Integration tests:** `pnpm --filter @crm/api test:e2e` — must pass, including the new `health-check-producer.e2e-spec.ts`.
7. **Regression:** confirm the full existing unit + e2e suite is otherwise unaffected.
8. **Hygiene:** `git status`; `git diff --stat -- .squad/config.yaml` (must be empty); confirm `apps/worker/**` has an empty diff.
9. **CI:** `gh run list --workflow=ci.yml --limit 5` if `gh` is reachable; otherwise report CI verification as explicitly pending — never assumed.

## Done Criteria

- [ ] `apps/api` has `@nestjs/bullmq`/`bullmq` at the same versions as `apps/worker`.
- [ ] `apps/api` registers `BullModule.forRootAsync` using the existing, unmodified `REDIS_URL` validation — no new environment variable.
- [ ] `apps/api` registers the **existing** `health-check` queue — no new queue name.
- [ ] `HealthCheckProducer` exists, exposes exactly one method (`ping`), and is not a generic multi-queue abstraction.
- [ ] No new public HTTP endpoint was introduced.
- [ ] `apps/worker/src/worker.module.ts` and `apps/worker/src/queues/health.processor.ts` are byte-for-byte unchanged.
- [ ] A unit test verifies `HealthCheckProducer.ping()` against a mocked queue.
- [ ] An integration/e2e test verifies a real enqueue against real Redis, and does not require `apps/worker` to run.
- [ ] No business behavior (SLA timers, `sla.at_risk`/`sla.breached`, escalation, `AutomationRule`, Notifications, integration sync, AI processing, reporting) was introduced.
- [ ] `.squad/config.yaml` is untouched.
- [ ] Full existing lint/typecheck/build/test suite (Identity & Access, Customer Management, Ticketing, SLA Policy Foundation) still passes with no regressions.

---

**STOP HERE. Report to the user and wait for confirmation before implementing.**
