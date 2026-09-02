> **Source:** manual entry (autonomous CLAUDE.md loop, no external tracker).
>
> Active tracker for this workspace: `github` — this story is not linked.

# Story intake

- Folder: `.squad/stories/error-tracking/error-tracking/intake.md`

---

## Feature

- **Feature name (display):** Cross-cutting — Sentry/GlitchTip error tracking
- **Feature slug (folder under `plans/`):** `error-tracking`

## Title

```text
Story 113 — Cross-cutting: Sentry/GlitchTip error tracking (backend + frontend)
```

## Description

```text
docs/architecture/11-quality-and-operations.md names, as the fourth and
final Observability target: "Sentry or self-hosted GlitchTip captures
unhandled frontend and backend exceptions." This story adds @sentry/node
to apps/api and apps/worker (skipOpenTelemetrySetup: true to avoid
colliding with Story 112's own NodeSDK, no tracesSampleRate -- exception
capture only), and @sentry/nextjs to apps/web and apps/portal, wired into
the existing [locale]/error.tsx render-exception boundary from Story 96.
SENTRY_DSN/NEXT_PUBLIC_SENTRY_DSN are optional everywhere -- Sentry and
GlitchTip are protocol-compatible, so no external provider decision
blocks shipping the integration code itself.
```

## Acceptance criteria

```text
- [ ] SENTRY_DSN optional in both backend apps' env validation;
      documented in .env.example.
- [ ] Both backend main.ts files import ./sentry right after ./tracing;
      skipOpenTelemetrySetup: true, no tracesSampleRate above 0.
- [ ] apps/api's SentryExceptionFilter reports 500+/non-HttpExceptions,
      skips <500 HttpExceptions, delegates to BaseExceptionFilter
      unchanged.
- [ ] Every apps/worker processor reports via @OnWorkerEvent("failed");
      AiProcessingProcessor also reports from its own existing catch
      block (its job never actually fails at the BullMQ level).
- [ ] apps/web/apps/portal initialize Sentry client/server/edge;
      [locale]/error.tsx reports the render exception it already
      catches.
- [ ] pnpm --filter @crm/web build and pnpm --filter @crm/portal build
      both succeed with Sentry wrapping in place.
- [ ] Unit coverage for the filter, each processor's onFailed handler,
      and both error.tsx components.
- [ ] Full verification cycle green; e2e sweep shows only the 4 disclosed
      pre-existing environmental failures.
```

## Dependencies

- Story 111 — `CorrelationIdStore`/`common/logging/` convention this
  story's `sentry.ts` bootstrap mirrors.
- Story 112 — `tracing.ts`'s own `NodeSDK`, the reason
  `skipOpenTelemetrySetup: true` is required on the backend.
- Story 96 — the existing `[locale]/error.tsx` render-exception boundary
  this story wires Sentry into.

All prerequisites are complete; the story is fully unblocked.

## Out of scope

- Standing up a real Sentry project or GlitchTip instance.
- Sentry performance monitoring / tracing / Session Replay.
- `@sentry/nestjs` (own competing OTel auto-instrumentation).
- A new `app/global-error.tsx` (no root layout exists in either frontend
  app to correctly replace).
- Source-map upload (no Sentry org/project/auth token configured).
