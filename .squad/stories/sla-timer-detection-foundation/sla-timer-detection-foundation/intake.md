> **Source:** manual entry (tracker skipped via `--no-tracker`).
>
> Active tracker for this workspace: `github` — this story is not linked.
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

- Folder: `.squad/stories/sla-timer-detection-foundation/sla-timer-detection-foundation/intake.md`
- Binaries (screenshots, PDFs, exports): None.
- Do **not** rely on external links. The planner reads this file and files in `attachments/` only.

---

## Feature

- **Feature name (display):** SLA Timer Detection Foundation
- **Feature slug:** `sla-timer-detection-foundation`

## Tracker

- **Tracker type:** `github`
- **Work item id:** ``
- **Work item type:** ``
- **Status:** ``
- **Assignee:** ``
- **Labels:** ``

## Title

SLA Timer Detection Foundation

## Description

Build the first real SLA background-timer capability on top of the BullMQ producer foundation delivered by Story 14.

Current verified infrastructure:

- `apps/api` has BullMQ/Redis producer infrastructure from Story 14.
- `apps/worker` has BullMQ/Redis connectivity from Story 02.
- `apps/api` already validates and requires `REDIS_URL`.
- `SlaTicketTarget` already stores immutable `responseTargetAt` and `resolutionTargetAt`.
- Stories 12–13 provide business-hours-aware SLA target computation.
- `EventEmitter2` exists only inside `apps/api` and is an in-process communication mechanism.
- `apps/worker` currently has no Prisma/database wiring.
- No `sla.at_risk` or `sla.breached` implementation exists.
- Installed BullMQ version is `6.2.0`.
- Installed `@nestjs/bullmq` version is `11.0.5`.

The timer detection itself must run in `apps/worker`.

Because `apps/worker` currently has no Prisma access, add only the minimum Prisma/database infrastructure required for the worker to query `SlaTicketTarget` together with the related `Ticket` and `SlaPolicy` data. Do not copy the entire API architecture into the worker.

Because `EventEmitter2` exists only inside `apps/api`, the worker must not attempt to call it directly.

Use a narrow BullMQ hand-back mechanism:

1. `apps/api` registers the `sla-timers` queue through the existing `QueuesModule`.
2. `apps/api` provides a narrow `SlaTimersProducer`.
3. The producer creates an idempotent recurring scheduler using `Queue.upsertJobScheduler`.
4. `apps/worker` consumes the `sla-timers` queue.
5. The worker queries relevant `SlaTicketTarget` records.
6. The worker determines at-risk and breached transitions.
7. The worker persists fire-once/idempotency state.
8. The worker publishes typed SLA detection event jobs onto a dedicated worker-to-api hand-back queue.
9. `apps/api` consumes those hand-back jobs.
10. `apps/api` translates them into the existing `EventEmitter2` events:

- `sla.at_risk`
- `sla.breached`

Do not introduce a generic cross-process event bus or generic event framework. This story requires only the minimum SLA-specific bridge between the worker and `apps/api`.

### BullMQ

- Use `bullmq@6.2.0`.
- Use `@nestjs/bullmq@11.0.5`.
- Use `Queue.upsertJobScheduler`.
- Do not use the deprecated direct repeatable-job pattern.
- Scheduler interval is exactly **60 seconds**.
- Represent the interval as a named constant.
- Scheduler registration must be idempotent and must not create duplicate schedulers on application startup.

### Queue ownership

Extend the existing `apps/api/src/queues/queues.module.ts` from Story 14.

Do not create another parallel BullMQ connection/module.

Register the `sla-timers` queue there and register the dedicated SLA hand-back queue there if required by the selected implementation.

Do not modify the existing `health-check` queue, `HealthCheckProducer`, or `HealthProcessor`.

### At-risk semantics

An SLA target becomes at risk during the final **20%** of its configured SLA duration.

For response targets use:

- `SlaPolicy.responseTargetMinutes`

For resolution targets use:

- `SlaPolicy.resolutionTargetMinutes`

At-risk begins when the current time reaches the beginning of the final 20% of the configured duration and continues only while the current time is before `targetAt`.

Breach is defined as:

- `now >= targetAt`

A breached target is no longer treated as merely at risk.

If a target moves directly from not-at-risk to breached between timer runs, emit only `sla.breached`. Do not emit a retroactive `sla.at_risk`.

Both at-risk and breach are **fire-once transitions**.

Repeated scheduler executions must not emit duplicate events.

### Idempotency and persistence

Persist the state required to guarantee fire-once behavior across timer executions and overlapping executions.

The existing:

- `responseTargetAt`
- `resolutionTargetAt`

fields remain immutable.

Adding nullable bookkeeping fields to `SlaTicketTarget` is allowed and expected if it is the smallest coherent design.

Possible fields include:

- `responseAtRiskNotifiedAt`
- `responseBreachedNotifiedAt`
- `resolutionAtRiskNotifiedAt`
- `resolutionBreachedNotifiedAt`

The exact field names and migration structure should be finalized during planning.

The implementation must provide a real persistence-based idempotency guarantee. Do not rely on in-memory flags.

The chosen transaction/update strategy must prevent concurrent or repeated timer executions from generating duplicate fire-once events.

Story 11's immutability decision remains intact: target timestamps are never recomputed or modified. Only notification/idempotency bookkeeping may mutate.

### Ticket lifecycle

Closed/resolved tickets must not continue generating SLA events.

Detection must filter according to the existing `Ticket.status` model so only tickets still relevant to SLA monitoring are evaluated.

Do not introduce a new Ticket status.

Do not modify existing Ticket lifecycle behavior.

### Time and business hours

Compare the current time directly against the already-computed absolute target timestamps.

Do not:

- call `addBusinessMinutes` again;
- recalculate SLA targets;
- read `BusinessHoursCalendar`;
- read calendar exceptions;
- modify `responseTargetAt`;
- modify `resolutionTargetAt`.

Business-hours logic belongs to target creation, not timer detection.

### Multi-tenancy

`TenantContext` is request-scoped and unavailable inside BullMQ jobs.

The periodic timer is therefore a global sweep across all relevant branches.

This is intentional and is not considered a tenancy violation.

Every emitted event must include the correct:

- `ticketId`
- `branchId`

so downstream consumers can correctly scope their own processing.

### Event contract

Create SLA-owned event constants/types following the existing `*.events.ts` convention.

Required events:

- `sla.at_risk`
- `sla.breached`

Each event payload must contain at minimum:

- `ticketId`
- `branchId`
- `targetType: "response" | "resolution"`
- `targetAt`

The BullMQ hand-back job payload must be typed and contain enough information for `apps/api` to emit the correct event without ambiguity.

Do not introduce arbitrary untyped event payloads.

### Worker architecture

Add only the minimum worker infrastructure required by this story.

The worker needs:

- Prisma/database access;
- the SLA timer processor;
- the worker-to-api SLA event producer.

The processor must:

- run from the scheduled `sla-timers` job;
- query relevant SLA targets;
- evaluate response and resolution targets;
- determine state transitions;
- persist idempotency state;
- enqueue the corresponding hand-back event jobs.

The processor must not:

- use `TenantContext`;
- recompute SLA targets;
- modify target timestamps;
- implement Notifications;
- implement escalation;
- implement AI;
- implement Integrations;
- implement Reporting.

### API event bridge

Add the smallest possible `apps/api` consumer required to consume SLA hand-back jobs.

The consumer must:

- consume only the dedicated SLA hand-back queue;
- use the typed payload;
- emit `sla.at_risk` or `sla.breached` through `EventEmitter2`;
- contain no notification/escalation business behavior.

### Concurrency

The implementation must guarantee that if the same timer job is processed repeatedly or concurrently, the same SLA transition cannot generate duplicate fire-once events.

The persistence strategy must be safe across multiple worker instances/processes.

## Acceptance criteria

- [ ] `sla-timers` is registered through the existing `apps/api` `QueuesModule`.
- [ ] No second/parallel BullMQ connection module is introduced in `apps/api`.
- [ ] `SlaTimersProducer` exists and is responsible for the recurring SLA timer scheduler.
- [ ] The scheduler uses `Queue.upsertJobScheduler`.
- [ ] Scheduler interval is exactly 60 seconds and represented by a named constant.
- [ ] Scheduler registration is idempotent.
- [ ] `apps/worker` consumes the `sla-timers` queue.
- [ ] `apps/worker` has only the minimum Prisma/database infrastructure required for SLA detection.
- [ ] Detection reads existing `SlaTicketTarget` data and related `Ticket`/`SlaPolicy` data.
- [ ] Response detection uses `responseTargetMinutes`.
- [ ] Resolution detection uses `resolutionTargetMinutes`.
- [ ] At-risk starts during the final 20% of the configured SLA duration.
- [ ] `now >= targetAt` is treated as breached.
- [ ] A direct transition to breach emits breach only.
- [ ] At-risk events are fire-once.
- [ ] Breach events are fire-once.
- [ ] Repeated/concurrent timer executions cannot generate duplicate transitions/events.
- [ ] Closed/resolved tickets are excluded according to the existing Ticket status model.
- [ ] `responseTargetAt` and `resolutionTargetAt` remain immutable.
- [ ] Business-hours calculation is not rerun during detection.
- [ ] `TenantContext` is not used by the worker.
- [ ] Event payloads contain `ticketId`, `branchId`, `targetType`, and `targetAt`.
- [ ] `sla.at_risk` and `sla.breached` are defined using the existing SLA event naming convention.
- [ ] Worker-generated SLA events use a typed BullMQ hand-back payload.
- [ ] `apps/api` consumes the hand-back queue and emits through its existing `EventEmitter2`.
- [ ] No generic cross-process event bus is introduced.
- [ ] No real notification, escalation, AI, integration, reporting, or frontend behavior is implemented.
- [ ] Existing `health-check` BullMQ functionality remains unchanged.
- [ ] Any required Prisma migration is included and applied successfully.
- [ ] Unit tests cover at-risk, breach, direct-breach, duplicate-prevention, lifecycle filtering, and payload behavior.
- [ ] Integration/e2e tests use real Redis/Postgres infrastructure where appropriate.
- [ ] Tests verify the scheduler/timer job can reach the worker.
- [ ] Tests verify persisted idempotency state.
- [ ] Tests verify the expected hand-back event job.
- [ ] Tests verify duplicate execution does not produce duplicate fire-once events.
- [ ] Tests clean up created jobs and database records where appropriate.
- [ ] Existing unit/e2e suites remain green.

## Attachments

| File (relative to this folder) | What it is     |
| ------------------------------ | -------------- |
| None                           | No attachments |

## Dependencies

- **Blocked by / related ids:** Story 02 — worker/BullMQ foundation; Story 11 — SLA target immutability; Story 12 — business-hours calendar foundation; Story 13 — business-hours-aware SLA target computation; Story 14 — API BullMQ producer foundation.
- **Depends on code areas or other stories:** `apps/api/src/queues/`, `apps/api/src/app.module.ts`, `apps/api` configuration, `apps/worker/src/`, `SlaTicketTarget`, `SlaPolicy`, `Ticket`, existing `EventEmitter2` event/listener architecture.

## Extra notes

- This story resolves the architectural tension identified during recon: background detection runs in `apps/worker`, while domain events remain inside `apps/api` through a narrow BullMQ hand-back bridge.
- This story does not reopen Stories 11–13.
- Story 16 remains responsible for `ticket.recategorized` and SLA target recomputation.
- Story 17 remains responsible for escalation reactions.
- The worker's global sweep is intentional because `TenantContext` is request-scoped and unavailable in background jobs.
- Do not infer or add a generic background-job framework beyond what this story requires.

## Technical hints

- Reuse the existing `QueuesModule`.
- Reuse `REDIS_URL`.
- Use `@nestjs/bullmq`.
- Use BullMQ `Queue.upsertJobScheduler`.
- Use BullMQ processors in `apps/worker`.
- Use Prisma for worker-side SLA target reads and persisted idempotency state.
- Follow existing SLA event naming patterns such as `*.events.ts`.
- Follow existing `EventEmitter2` usage inside `apps/api`.
- Primary language: `typescript`.
- Repository root: `.`.

## Out of scope

- `ticket.recategorized` and SLA target recomputation — Story 16.
- Escalation processing/reactions — Story 17.
- Notification implementation.
- Channels.
- `AutomationRule`.
- AI processing.
- Integration synchronization.
- Reporting.
- Frontend changes.
- CASL/authorization changes.
- OpenTelemetry/BullMQ instrumentation.
- Bull Board or queue dashboards.
- Redis authentication/TLS hardening.
- A generic multi-queue producer abstraction beyond the narrow SLA timer producer.
- A generic cross-process event bus.
- A new public HTTP endpoint.
- A new Ticket status.
- Recalculation of business-hours-aware targets.
- Modification of `responseTargetAt` or `resolutionTargetAt`.
- Use of `TenantContext` inside the worker.
- Changes to the existing `health-check` queue or its processor.
- Changes to `apps/worker` unrelated to SLA timer detection.
- Any unrelated Prisma/domain refactoring.

## Verification

The final implementation must verify at minimum:

1. `pnpm install`
2. API typecheck/lint/build.
3. Workspace typecheck/lint/build.
4. API unit tests.
5. Redis is available.
6. Postgres is available.
7. API integration/e2e tests.
8. Worker timer/detection tests.
9. Idempotency behavior under repeated execution.
10. Existing regression suite.
11. `git status` and diff inspection.
12. Confirm `.squad/config.yaml` is untouched.
13. Confirm Story 14's `health-check` functionality remains unchanged.
14. If CI is checked with `gh`, report it as pending if `gh` is unavailable; never assume CI success.

## Done criteria

The story is complete only when the SLA timer can run periodically, detect at-risk/breached response and resolution targets, persist fire-once state safely, hand typed events from `apps/worker` back to `apps/api`, and emit the existing `sla.at_risk` / `sla.breached` domain events without introducing unrelated business behavior.

STOP after producing the plan and wait for confirmation before implementing.
