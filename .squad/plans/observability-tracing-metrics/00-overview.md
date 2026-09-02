# observability-tracing-metrics — plan overview

Entry point for the **observability-tracing-metrics** feature.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 112 | [112-story-observability-tracing-metrics.md](./112-story-observability-tracing-metrics.md) | Cross-cutting — OpenTelemetry tracing + Prometheus metrics | — | Story 111 (`CorrelationIdStore`), Story 76 (`ai-processing` bridge) |

## Dependency notes

- Selected via a fresh whole-repository Recon after Story 111 closed, from
  the standing, user-approved unblocked backlog. Chosen over the other 6
  remaining candidates (108 presence UI, 109 multi-locale KB, 110 saved
  dashboards, 114 Playwright E2E, 115 audit-log DB grants, and 113
  Sentry/GlitchTip — a close second) specifically on **dependency
  correctness** (CLAUDE.md §2 priority 1): `docs/architecture/11-quality-and-operations.md`'s
  Observability section runs structured logs/correlation id (111, done) →
  OpenTelemetry tracing → Prometheus metrics → Sentry. OpenTelemetry is
  the more architecturally coherent next layer over Sentry specifically
  because it composes directly with Story 111's `CorrelationIdStore` (the
  same id can become a span attribute, unifying logs and traces), and it
  covers two Observability bullets (tracing + Prometheus metrics) in one
  story. The other 6 candidates are independent leaves with no unlocking
  relationship to anything else in the backlog (confirmed unchanged from
  the Story 111 Recon's own analysis).
- **The gap**: no `@opentelemetry/*`, `prom-client`, or `@sentry/*`
  dependency existed in any package.json in the repository; no `/metrics`
  endpoint existed (only `/health` liveness).
- **Why not externally blocked**: purely internal instrumentation and a
  local exporter-endpoint default — no external provider/credential
  decision is needed to *ship the instrumentation itself*, unlike the 8
  deliberately-deferred Stories 116-123. Standing up an actual Tempo/
  Prometheus/Grafana collector stack is a separate, later concern (see
  the story doc's Non-Goals) — this story ships the producer side only.
- **Dependency correctness / architectural coherence**: reuses Story 111's
  already-established "no cross-app shared-runtime mechanism" convention
  (a duplicated `tracing.ts` bootstrap file per app, mirroring
  `common/logging/`'s own precedent) rather than introducing a new
  cross-app sharing mechanism. `@prisma/instrumentation` is pinned to
  `6.19.3` (matching `@prisma/client`'s own version) rather than the
  `pnpm add` default-resolved `7.x`, which targets a Prisma major version
  this repository does not use — confirmed via `@prisma/instrumentation`'s
  own usage docs that no `previewFeatures` flag is needed on Prisma
  6.19.3's stabilized tracing support.
- **Product value / risk reduction**: this system's core operational risk
  lives in its async pipeline (BullMQ queues for AI processing/SLA
  timers/notifications); proactive queue-depth/HTTP-latency visibility
  reduces operational risk more directly than a purely reactive
  error-capture tool (Sentry, Story 113) would for this specific
  codebase's current gaps.
- **Verification method**: OpenTelemetry/pino bootstrap files
  (`tracing.ts`) are deliberately imported ONLY from each app's own
  `main.ts` — never from any service/controller/spec file — so Vitest
  unit/e2e specs (which import `AppModule`/individual services directly)
  never exercise them, mirroring `main.ts`'s own pre-existing CORS/
  `RedisIoAdapter` setup, which is equally outside the automated suite's
  reach. Verified instead via a real, manual smoke test: both apps' built
  `dist/main.js` were started against the real dev Postgres/Redis, hit
  with real HTTP traffic (`apps/api`) and real queued BullMQ jobs
  (`apps/worker`), and confirmed to boot and process normally with no
  crash and no instrumentation-related errors. The Prometheus `/metrics`
  endpoint (a real NestJS route, unlike the tracing bootstrap) IS fully
  covered by the automated e2e suite (`test/metrics.e2e-spec.ts`).
