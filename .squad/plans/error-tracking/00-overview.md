# error-tracking — plan overview

Entry point for the **error-tracking** feature.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 113 | [113-story-error-tracking.md](./113-story-error-tracking.md) | Cross-cutting — Sentry/GlitchTip error tracking (backend + frontend) | — | Story 111 (`CorrelationIdStore`), Story 112 (`tracing.ts`, the OTel-collision constraint) |

## Dependency notes

- Selected via a fresh whole-repository Recon after Story 112 closed, from
  the standing, user-approved unblocked backlog (108, 109, 110, 113, 114,
  115 remaining at that point). Chosen on **dependency correctness**
  (CLAUDE.md §2 priority 1): `docs/architecture/11-quality-and-operations.md`'s
  Observability section names exactly four bullets — structured logs/
  correlation ID (111), OpenTelemetry tracing (112), Prometheus metrics
  (112), and "Sentry or self-hosted GlitchTip captures unhandled frontend
  and backend exceptions" (113, the last one). Finishing this closes a
  fully-scoped arc while its own conventions (module boundaries,
  duplicated-bootstrap-per-app pattern) are freshest, rather than starting
  a net-new domain area (108 frontend presence UI, 109 KB schema i18n, 110
  a new `Dashboard` model) with no such continuation relationship.
- **Why this is NOT one of the 8 externally-blocked Stories (116-123)**:
  unlike "which email/WhatsApp/SMS provider," Sentry and self-hosted
  GlitchTip are protocol-compatible — the exact same DSN-based SDK
  configuration works for either, so no actual vendor decision blocks
  writing the integration code itself. `SENTRY_DSN` is optional
  everywhere in this story (mirroring `CORS_ORIGINS`'s/`ANTHROPIC_API_KEY`'s
  own "unset is a valid, expected state" precedent) — the *choice* of
  which concrete provider/project to point it at is a deployment-time
  decision, not a code-time blocker.
- **The critical design constraint this story is built around**: Sentry's
  JS SDK (v8+) is itself built on OpenTelemetry. Story 112 already gave
  `apps/api`/`apps/worker` their own complete `NodeSDK` (`tracing.ts`).
  Naively calling `Sentry.init()` would install a second, competing set of
  global OTel providers/context managers. Resolved via
  `skipOpenTelemetrySetup: true` (documented `@sentry/node`/`@sentry/node-core`
  option for "I already manage OpenTelemetry myself") + never setting
  `tracesSampleRate` above 0 — this scopes Sentry to pure exception
  capture on the backend, deliberately not a second tracing system
  (OTel already covers that Observability bullet). `@sentry/node`, not
  `@sentry/nestjs`, for the same reason: the latter wires its own
  additional Nest-specific OTel auto-instrumentation.
- **Architectural coherence**: backend bootstrap files (`sentry.ts`,
  imported as each `main.ts`'s second line, right after `./tracing`) and
  worker-side capture points (`@OnWorkerEvent("failed")` on every
  processor, plus an explicit `Sentry.captureException` in
  `AiProcessingProcessor`'s own pre-existing catch block — the one path
  where a job never actually fails at the BullMQ level) reuse the exact
  per-app-duplicated-bootstrap convention Stories 111/112 already
  established, rather than inventing a new one. `SentryExceptionFilter`
  (apps/api) extends NestJS's own `BaseExceptionFilter` and delegates to
  `super.catch()` — it can only ever *add* a side effect, never change an
  existing response, which is what let the full, unmodified e2e suite
  (450+ assertions on exact status codes/response bodies) serve as the
  real regression check for it.
- **Frontend scope, and why it landed on the existing `[locale]/error.tsx`
  boundary, not a new `global-error.tsx`**: both `apps/web` and
  `apps/portal` use `next-intl`'s `[locale]` segment routing with no root
  `app/layout.tsx` — Next.js's own `global-error.tsx` contract requires
  replacing that root layout, which doesn't exist here. Sentry's own
  build-time warning about a missing global error handler is therefore
  expected and accepted (documented in the story doc's Non-Goals), not
  silently worked around by restructuring this app's layout tree as a
  side effect of an error-tracking story. The already-existing
  `[locale]/error.tsx` boundary (Story 96) is the real, already-correct
  integration point — its own doc comment even said "no analytics/
  reporting pipeline exists in this repository to send it to," which this
  story closes directly.
