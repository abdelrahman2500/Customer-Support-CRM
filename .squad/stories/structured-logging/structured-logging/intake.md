> **Source:** manual entry (autonomous CLAUDE.md loop, no external tracker).
>
> Active tracker for this workspace: `github` — this story is not linked.

# Story intake

- Folder: `.squad/stories/structured-logging/structured-logging/intake.md`

---

## Feature

- **Feature name (display):** Cross-cutting — Structured JSON logs + correlation ID propagation
- **Feature slug (folder under `plans/`):** `structured-logging`

## Title

```text
Story 111 — Cross-cutting: Structured JSON logs + a correlation ID from API requests into worker jobs
```

## Description

```text
docs/architecture/11-quality-and-operations.md names, as the first
Observability target: "Structured JSON logs use pino; a correlation/
request ID propagates from API requests into worker jobs." Neither half
existed. This story adds a pino-backed NestJS LoggerService (duplicated
per-app, following this codebase's existing "no cross-app shared-runtime
mechanism" convention) plus an AsyncLocalStorage-based correlation-id
store, wired through RequestIdMiddleware in apps/api and propagated into
the one producer genuinely triggered by an HTTP request today
(AiProcessingProducer), consumed by apps/worker's AiProcessingProcessor.
```

## Acceptance criteria

```text
- [ ] pino added to apps/api and apps/worker.
- [ ] Both apps' main.ts wires the new pino-backed LoggerService via
      app.useLogger(...); existing log call sites unchanged.
- [ ] apps/api honors/generates x-request-id, echoes it on the response,
      and every log line in that request carries the same correlationId.
- [ ] AiProcessingJobPayload carries an optional correlationId, populated
      at both apps/api enqueue call sites (TicketAiService, AiChatService).
- [ ] apps/worker's AiProcessingProcessor binds that id (or a fresh one)
      for the life of processing one job.
- [ ] Unit coverage for CorrelationIdStore, PinoLoggerService,
      RequestIdMiddleware, both producer call sites, and the processor's
      store-wrapping.
- [ ] e2e coverage: caller-supplied x-request-id echoed back; one is
      still generated when absent.
- [ ] Full verification cycle green; e2e sweep shows only the 4 disclosed
      pre-existing environmental failures.
```

## Dependencies

- Story 76 — `ai-processing` bridge (`AiProcessingProducer`/
  `AiProcessingProcessor`, the duplicated-interface convention this story
  reuses).
- Story 80 — `CHAT` feature / `AiChatService`'s own enqueue call site.

All prerequisites are complete; the story is fully unblocked.

## Out of scope

- OpenTelemetry, Prometheus metrics, Sentry/GlitchTip (Stories 112/113).
- Correlation id on the reverse `ai-processing-events` hand-back queue.
- `SlaTimersProducer`/`HealthCheckProducer` (no HTTP request to inherit
  an id from / no caller at all).
- `pino-http` automatic access logging.
- Any change to existing log message text or call sites.
