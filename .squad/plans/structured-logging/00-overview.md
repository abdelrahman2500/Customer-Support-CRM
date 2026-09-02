# structured-logging — plan overview

Entry point for the **structured-logging** feature.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 111 | [111-story-structured-logging.md](./111-story-structured-logging.md) | Cross-cutting — Structured JSON logs + a correlation ID from API requests into worker jobs | — | Story 76 (`ai-processing` bridge), Story 80 (`CHAT` feature) |

## Dependency notes

- Selected via a fresh whole-repository Recon after Story 107 closed, from
  the standing, user-approved unblocked backlog (108-115 remaining at that
  point). Chosen over the other 7 candidates specifically on **dependency
  correctness** (CLAUDE.md §2 priority 1): `docs/architecture/11-quality-and-operations.md`
  names OpenTelemetry (Story 112, still blocked-by-nothing but naturally
  *built on* request/job correlation) and Sentry/GlitchTip (Story 113,
  which benefits from being able to correlate an exception back to the
  request/job that caused it) as later Observability bullets in the same
  section this story implements the first bullet of. Building 112/113
  first would mean retrofitting request-context propagation into
  already-wired instrumentation later — the "building a dependent feature
  before its foundation" pattern §2 explicitly says to avoid. The other
  five candidates (108 presence UI, 109 multi-locale KB, 110 saved
  dashboards, 114 Playwright E2E, 115 audit-log DB grants) have no such
  unlocking relationship to anything else in the remaining backlog — each
  is an independent leaf, so none took priority over a genuine foundation.
- **The gap**: `docs/architecture/11-quality-and-operations.md`'s
  Observability section states as the target: "Structured JSON logs use
  `pino`; a correlation/request ID propagates from API requests into
  worker jobs." Confirmed directly against the repository: no `pino` (or
  any structured-logging library) dependency existed in `apps/api` or
  `apps/worker`; both used only NestJS's plain default `Logger` (`main.ts`
  in both apps); no request-id/correlation-id concept existed anywhere in
  `apps/api/src`.
- **Why not externally blocked**: purely internal, no external
  provider/credential decision needed, unlike the 8 deliberately-deferred
  Stories 116-123.
- **Dependency correctness / architectural coherence**: this codebase has
  established, and explicitly documented, a "no cross-app shared-constants
  mechanism" convention for anything that must exist identically in both
  `apps/api` and `apps/worker` (see `AiProcessingProducer`'s/
  `AiProcessingProcessor`'s own doc comments on the duplicated
  `AI_PROCESSING_QUEUE` literal and `AiProcessingJobPayload` interface).
  This story's logging/correlation infrastructure follows that same,
  already-established precedent — a small, duplicated `common/logging/`
  folder per app — rather than introducing this repository's first
  cross-app shared-runtime-code mechanism as a side effect of a logging
  story.
- **Product value / risk reduction**: every prior Story's completion
  report in this session has had to reason about "code failure vs.
  environmental failure" and pre-existing test-isolation defects by
  reading raw Nest console output; structured, correlatable logs are
  infrastructure every subsequent Story benefits from, and the
  architecture doc treats this as foundational Observability, not a
  nice-to-have.
- **Scope boundary (see the story doc's own Non-Goals)**: the *reverse*
  hand-back queue (`ai-processing-events`, worker → API) does not carry
  the correlation id in this story — only the forward direction the
  architecture doc's own wording literally describes ("from API requests
  into worker jobs") is delivered. `SlaTimersProducer` (a cron-driven
  scheduler, not a request-driven producer) and `HealthCheckProducer`
  (unused ping, no HTTP caller) are deliberately not wired for
  correlation propagation — neither is triggered by an HTTP request, so
  neither has a correlation id to propagate in the first place.
  OpenTelemetry (112), Prometheus metrics (112), and Sentry/GlitchTip
  (113) — the remaining three Observability bullets in the same
  architecture-doc section — are separate, later stories this one
  unblocks, not bundled in here.
