> **Source:** manual entry (tracker skipped via `--no-tracker`).
>
> Active tracker for this workspace: `github` — this story is not linked.

# Story intake

## Feature

- **Feature name (display):** Background Job Producer Foundation
- **Feature slug (folder under `plans/`):** `background-job-producer-foundation`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** ``
- **Work item type:** ``
- **Status:** ``
- **Assignee:** ``
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

Background Job Producer Foundation

---

## Description

Establish the API-side BullMQ producer foundation required for future background-job features.

The API currently has no BullMQ producer integration, while the worker already has a working BullMQ/Redis foundation and consumes the existing `health-check` queue.

This story should add the minimum API-side producer capability needed to enqueue a job onto the existing `health-check` queue, using the already-validated `REDIS_URL` configuration and the same BullMQ/@nestjs-bullmq versions already used by `apps/worker`.

The implementation must remain intentionally narrow and infrastructure-focused. It must not introduce real business queues or job-processing behavior.

The producer should be exposed through a small, single-purpose service rather than a generic multi-queue abstraction. No new public HTTP endpoint is required.

The existing worker-side `health-check` processor should remain unchanged. The purpose of the story is to prove that `apps/api` can successfully connect to Redis through BullMQ and enqueue a job onto the existing queue.

The story should include automated verification for:

- producer service behavior with the BullMQ queue mocked;
- successful enqueue against the real Redis/BullMQ infrastructure.

The exact feature planning should preserve the existing architecture decisions and avoid introducing abstractions that are not justified by current consumers.

---

## Acceptance criteria

- [ ] `apps/api` has `@nestjs/bullmq` and `bullmq` available using versions compatible with the existing `apps/worker` BullMQ setup.
- [ ] `apps/api` registers `BullModule.forRootAsync` using the existing validated `REDIS_URL`.
- [ ] No new Redis environment variable or duplicate Redis configuration is introduced.
- [ ] The API registers the existing `health-check` queue rather than introducing a new queue name.
- [ ] A small, single-purpose producer service exists in `apps/api` and can enqueue a ping-style job onto the `health-check` queue.
- [ ] No generic multi-queue producer abstraction is introduced.
- [ ] No new public HTTP endpoint is introduced solely to test the queue infrastructure.
- [ ] The existing `apps/worker` health-check processor remains unchanged.
- [ ] A unit test verifies the producer service's enqueue behavior with the BullMQ queue mocked.
- [ ] An integration/e2e test verifies that the API can successfully enqueue a job onto the real Redis-backed `health-check` queue.
- [ ] The test does not require `apps/worker` to run as part of the API e2e suite unless the final plan explicitly determines that a full producer-to-worker round trip is required.
- [ ] Existing API tests continue to pass.
- [ ] Existing typecheck, lint, and build checks continue to pass.
- [ ] No business behavior is introduced for SLA timers, notifications, integrations, AI processing, reporting, escalation, or automation rules.

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |
| None.                          |            |

---

## Dependencies

- **Blocked by / related ids:** None.
- **Depends on code areas or other stories:**
  - Story 02 — existing `apps/worker` + Redis/BullMQ foundation and `health-check` queue.
  - Story 10–13 — existing SLA foundation; no changes to their settled decisions are required.
  - `apps/worker/src/worker.module.ts` — existing BullMQ Redis registration pattern.
  - `apps/worker/src/queues/health.processor.ts` — existing `health-check` queue/consumer.
  - `apps/api/src/common/config/env.validation.ts` — existing validated `REDIS_URL`.
  - `apps/api/src/app.module.ts` — API module registration point.
  - `docker-compose.yml` — existing local Redis infrastructure.

---

## Extra notes

- Story 14 was identified during roadmap recon as the smallest technically-unblocked cross-cutting infrastructure increment after Story 13.
- The existing worker already proves that Redis/BullMQ connectivity works; this story adds the missing API producer side.
- The queue name `health-check` should be reused as the infrastructure verification fixture. Do not create a new queue for this story.
- The producer should remain intentionally narrow. Future domain queues such as `sla-timers`, `notifications`, `integration-sync`, `ai-processing`, and `reports-refresh` belong to the feature stories that actually need them.
- The repository does not currently define a cross-app queue-name sharing convention. Do not introduce a shared abstraction unless the planner finds a concrete architectural reason to do so.
- CI verification may remain environment-dependent; do not claim CI success unless it is actually executed and verified.

---

## Technical hints

- `BullModule.forRootAsync`
- `@InjectQueue`
- BullMQ `Queue`
- `REDIS_URL`
- Existing worker queue: `HEALTH_CHECK_QUEUE = "health-check"`
- Existing worker BullMQ versions: `bullmq`, `@nestjs/bullmq`
- Primary language: `typescript`
- Repo root: `.`
- Main API root: `apps/api`
- Worker root: `apps/worker`

---

## Out of scope

- SLA timer implementation.
- `sla.at_risk` events.
- `sla.breached` events.
- SLA escalation.
- `AutomationRule`.
- Notifications.
- Communication/Channels.
- AI processing.
- Integration synchronization.
- Reporting jobs.
- Any real business-domain background job.
- Introducing the `sla-timers` queue.
- Introducing `notifications`, `integration-sync`, `ai-processing`, or `reports-refresh` queues.
- Generic multi-queue producer/framework abstractions.
- Queue-processing logic in `apps/worker`.
- Changes to the existing `health-check` worker processor.
- New public HTTP endpoints used only for infrastructure testing.
- Bull Board.
- OpenTelemetry/BullMQ instrumentation.
- Redis authentication or TLS hardening.
- Production Redis infrastructure changes.
- Frontend changes.
- Knowledge Base, Portal, Channels, AI, Reporting, Integrations, or Administration features.
