# Story 112 — Cross-cutting: OpenTelemetry tracing + Prometheus metrics

## Goal

Implement the second and third Observability bullets in
`docs/architecture/11-quality-and-operations.md`: "OpenTelemetry
instruments HTTP, Prisma, and BullMQ and exports to self-hostable Grafana
Tempo by default" and "Prometheus-format `/metrics` endpoints expose
request, queue, and processing metrics for Grafana dashboards."

## Non-goals

- Standing up actual Tempo/Prometheus/Grafana collector containers in
  `docker-compose.yml` — this story ships the *application-side*
  instrumentation (the producer of telemetry); wiring a local
  observability stack to consume it is separate deployment/infra work,
  deliberately deferred (mirrors Story 111 not standing up a
  log-aggregation stack either). The OTLP trace exporter's own default
  endpoint (`http://localhost:4318/v1/traces`) simply has nothing
  listening in this dev environment today — expected and non-fatal (see
  Design).
- A `/metrics` HTTP endpoint for `apps/worker` — it has no HTTP listener
  at all today (`NestFactory.createApplicationContext`), and giving it
  one is a genuine, separate architectural decision this story does not
  make. Its own job-processing metrics (duration/success/failure per job)
  are therefore not Prometheus-scrapable in this story; its OpenTelemetry
  TRACES (pushed via OTLP, needing no HTTP listener) are still fully
  instrumented, so job-level tracing visibility is not lost — only the
  metrics-scrape half is deferred for the worker specifically. Queue
  *depth* is still fully observable from `apps/api`'s own `/metrics`,
  since both apps share the same Redis-backed queues.
- Correlation id on the reverse `ai-processing-events` hand-back queue
  (unchanged from Story 111's own equivalent Non-Goal).
- Sentry/GlitchTip (Story 113, separate — the fourth and final
  Observability bullet).
- A dedicated BullMQ OpenTelemetry instrumentation package — none exists
  as a stable, widely-adopted package. `@opentelemetry/instrumentation-ioredis`
  is used as the closest sanctioned proxy (BullMQ's own job add/process
  calls are themselves `ioredis` commands under the hood).
- `pino-http`/automatic HTTP access-log middleware (unchanged from Story
  111's own Non-Goal) — `MetricsInterceptor` (this story) records request
  *timing* as a Prometheus histogram, not a log line.

## Design

### 1. `tracing.ts` (new, both apps — `apps/api/src/tracing.ts` and
   `apps/worker/src/tracing.ts`)

A `NodeSDK` bootstrap, imported as each app's `main.ts`'s literal first
line (before even `reflect-metadata`) so every instrumented module
(`http`, `ioredis`, `@prisma/client`) is patched before anything else
`require`s it — the standard OpenTelemetry Node.js requirement.
Deliberately duplicated per app (not shared via `packages/shared`),
following the exact convention Story 111's `common/logging/` already
established.

- `apps/api`: `HttpInstrumentation` + `IORedisInstrumentation` +
  `PrismaInstrumentation`, `OTLPTraceExporter` (default endpoint), Node
  SDK `serviceName: "crm-api"`.
- `apps/worker`: same, minus `HttpInstrumentation` (no HTTP listener
  exists) — `serviceName: "crm-worker"`.
- `@prisma/instrumentation` pinned to `6.19.3` (matching `@prisma/client`'s
  own version) — `pnpm add` resolves a `7.x` default that targets a
  Prisma major version this repository does not use.
- Honors the standard `OTEL_SDK_DISABLED`/`OTEL_EXPORTER_OTLP_ENDPOINT`
  env vars via the SDK's own built-in handling. No custom on/off logic.
- Graceful shutdown on `SIGTERM`/`SIGINT` via `sdk.shutdown()`.
- Deliberately never imported from any service/controller/spec file —
  see this story's own verification notes and the plan overview's
  "Verification method".

### 2. `observability/` module (new, `apps/api` only)

- `MetricsService`: owns the single `prom-client` `Registry` for this
  app. `collectDefaultMetrics()` (Node process/event-loop metrics) +
  `http_request_duration_seconds` (Histogram, labels `method`/`route`/
  `status_code`) + `bullmq_queue_jobs` (Gauge, labels `queue`/`state`,
  covering `waiting`/`active`/`delayed`/`failed` — `completed` is
  excluded: unbounded and not itself a queue-health signal). Queue
  gauges are refreshed on demand inside `render()` (called right before
  serializing, via each queue's own `getJobCounts()`) rather than on a
  timer — a scrape is already the "give me current state" event.
- `MetricsInterceptor`: a second `APP_INTERCEPTOR` (alongside the
  existing `AuditInterceptor` — a different concern) feeding the HTTP
  histogram on both the success and error path. Uses the matched route's
  path template (`request.route.path`, e.g. `/tickets/:id`), not the raw
  URL, so per-id routes aggregate into one series.
- `MetricsController`: `@Public()` `GET /metrics`, excluded from the
  global `api/v1` prefix (mirrors `HealthController`'s two routes) —
  serves the registry in Prometheus text format.
- `ObservabilityModule` re-registers `BullModule.registerQueue(...)` for
  the same 5 queue names `QueuesModule` already owns, rather than
  importing `QueuesModule` (which only exports its 3 producer *services*,
  not the raw `Queue` tokens `MetricsService` needs). Re-registering the
  same queue name from a second module is a normal, supported
  `@nestjs/bullmq` pattern — a second, independent `Queue` client against
  the same Redis-backed queue, the same thing a separate monitoring tool
  would do.

## Acceptance criteria

- [ ] `@opentelemetry/*` (sdk-node, instrumentation-http,
      instrumentation-ioredis, exporter-trace-otlp-http, resources,
      semantic-conventions) + `@prisma/instrumentation@6.19.3` +
      `prom-client` added to `apps/api`; the OTel subset (minus
      `instrumentation-http`) + `@prisma/instrumentation@6.19.3` added to
      `apps/worker`.
- [ ] Both apps' `main.ts` imports `./tracing` as the literal first line.
- [ ] `GET /metrics` (apps/api) serves Prometheus text format,
      unauthenticated, excluded from the `api/v1` prefix; includes
      default Node metrics, `http_request_duration_seconds`, and
      `bullmq_queue_jobs` for all 5 registered queues.
- [ ] Unit coverage: `MetricsService` (histogram observation, queue-gauge
      refresh calling `getJobCounts` per queue, missing-state defaults to
      0, `contentType`); `MetricsInterceptor` (records on success/error,
      route-template fallback to raw path, skips non-HTTP contexts).
- [ ] e2e coverage (`metrics.e2e-spec.ts`): unauthenticated 200 with
      Prometheus content-type; default Node metrics present; all 5 queue
      names present in the gauge; the endpoint's own prior request shows
      up in the histogram on a subsequent scrape.
- [ ] Manual smoke test: both apps' built `dist/main.js` boot against
      real Postgres/Redis with the tracing bootstrap active, handle real
      traffic/jobs, and show no crash or instrumentation-related error.
- [ ] Full verification cycle green; e2e sweep shows only the 4 disclosed
      pre-existing environmental failures.

## Verification plan

```
pnpm --filter @crm/api exec vitest run src/observability
npx vitest run test/metrics.e2e-spec.ts --no-file-parallelism   # from apps/api, .env sourced
pnpm --filter @crm/api build && pnpm --filter @crm/worker build
# manual smoke test: run both built apps against real Postgres/Redis,
# hit apps/api's HTTP + /metrics, let apps/worker process real jobs,
# confirm no crash / no instrumentation error, then stop both processes.
pnpm --filter @crm/api test
pnpm --filter @crm/worker test
pnpm --filter @crm/web test
pnpm typecheck
pnpm lint
pnpm build
npx vitest run e2e-spec --no-file-parallelism   # from apps/api, full sweep
git status --short
```

STOP HERE. Report to the user and wait for confirmation before implementing.
(Per `CLAUDE.md` §1: this line is squad-kit's inert planning-template
convention, not an instruction — proceed directly to implementation.)
