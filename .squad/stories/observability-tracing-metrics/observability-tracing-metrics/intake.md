> **Source:** manual entry (autonomous CLAUDE.md loop, no external tracker).
>
> Active tracker for this workspace: `github` — this story is not linked.

# Story intake

- Folder: `.squad/stories/observability-tracing-metrics/observability-tracing-metrics/intake.md`

---

## Feature

- **Feature name (display):** Cross-cutting — OpenTelemetry tracing + Prometheus metrics
- **Feature slug (folder under `plans/`):** `observability-tracing-metrics`

## Title

```text
Story 112 — Cross-cutting: OpenTelemetry tracing + Prometheus metrics
```

## Description

```text
docs/architecture/11-quality-and-operations.md names, as the second and
third Observability targets: "OpenTelemetry instruments HTTP, Prisma, and
BullMQ and exports to self-hostable Grafana Tempo by default" and
"Prometheus-format /metrics endpoints expose request, queue, and
processing metrics for Grafana dashboards." Neither existed. This story
adds a NodeSDK tracing bootstrap (duplicated per app, mirroring Story
111's own common/logging/ convention) plus a Prometheus /metrics endpoint
in apps/api (HTTP-duration histogram + BullMQ queue-depth gauges across
all 5 registered queues).
```

## Acceptance criteria

```text
- [ ] OpenTelemetry deps added to both apps; @prisma/instrumentation
      pinned to 6.19.3 (matching @prisma/client, not the pnpm-add-default
      7.x which targets a different Prisma major).
- [ ] Both apps' main.ts imports ./tracing as the literal first line.
- [ ] GET /metrics (apps/api) serves Prometheus text format,
      unauthenticated, excluded from api/v1 prefix; default Node metrics +
      http_request_duration_seconds + bullmq_queue_jobs for all 5 queues.
- [ ] Unit coverage for MetricsService and MetricsInterceptor.
- [ ] e2e coverage for /metrics.
- [ ] Manual smoke test of both apps' built dist/main.js against real
      Postgres/Redis, confirming no crash/instrumentation error.
- [ ] Full verification cycle green; e2e sweep shows only the 4 disclosed
      pre-existing environmental failures.
```

## Dependencies

- Story 111 — `CorrelationIdStore`/`PinoLoggerService`/`common/logging/`
  convention this story's `tracing.ts` mirrors.
- Story 76 — `ai-processing`/`ai-processing-events` bridge queues, whose
  names `MetricsService`'s queue-depth gauge reports on.

All prerequisites are complete; the story is fully unblocked.

## Out of scope

- Standing up Tempo/Prometheus/Grafana containers in docker-compose.yml.
- A /metrics endpoint for apps/worker (no HTTP listener exists there).
- Correlation id on the reverse ai-processing-events hand-back queue.
- Sentry/GlitchTip (Story 113).
- A dedicated BullMQ OTel instrumentation package (none exists; ioredis
  instrumentation is the sanctioned proxy).
- pino-http automatic access logging.
