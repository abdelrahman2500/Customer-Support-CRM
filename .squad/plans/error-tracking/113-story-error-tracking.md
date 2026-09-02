# Story 113 — Cross-cutting: Sentry/GlitchTip error tracking

## Goal

Implement the fourth and final Observability bullet in
`docs/architecture/11-quality-and-operations.md`: "Sentry or self-hosted
GlitchTip captures unhandled frontend and backend exceptions."

## Non-goals

- Standing up an actual Sentry project or GlitchTip instance, or choosing
  between them — `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` are optional
  everywhere; unset is a fully valid, expected local-dev state (mirrors
  `CORS_ORIGINS`'s/`ANTHROPIC_API_KEY`'s own precedent). This story ships
  the integration code; pointing it at a real DSN is a deployment-time
  configuration choice.
- Sentry performance monitoring / tracing / Session Replay — every
  `Sentry.init()` call in this story either omits `tracesSampleRate`
  entirely or sets it to `0`, and `skipOpenTelemetrySetup: true` on the
  backend. OpenTelemetry (Story 112) already owns tracing; this story is
  deliberately scoped to exception capture only, avoiding a second,
  competing tracing system.
- `@sentry/nestjs` — wires its own additional Nest-specific OTel
  auto-instrumentation, reintroducing the exact collision
  `skipOpenTelemetrySetup` avoids. Plain `@sentry/node` + a small,
  explicit `SentryExceptionFilter`/`@OnWorkerEvent("failed")` integration
  is used instead.
- A new `app/global-error.tsx` in `apps/web`/`apps/portal` — both apps
  route via `next-intl`'s `[locale]` segment with no root `app/layout.tsx`
  for `global-error.tsx` to correctly replace. Sentry's own build-time
  warning about this ("you don't have a global error handler set up") is
  expected and accepted, not silently worked around by restructuring the
  app's layout tree. The existing `[locale]/error.tsx` boundary (Story 96)
  is the real integration point instead.
- Source-map upload to Sentry (`next.config.mjs`'s `sourcemaps: { disable:
  true }`, no `authToken`) — requires a real Sentry org/project/auth
  token this story does not configure.

## Design

### Backend (`apps/api`, `apps/worker`)

- `@sentry/node@10.73.0` added to both apps.
- `SENTRY_DSN: z.string().optional()` added to both apps' `env.validation.ts`
  (mirrors `CORS_ORIGINS`/`ANTHROPIC_API_KEY`'s own precedent).
- `sentry.ts` (new, both apps): `Sentry.init({ dsn, environment,
  skipOpenTelemetrySetup: true })`, guarded by `SENTRY_DSN` being set.
  Imported as each `main.ts`'s second line, right after `./tracing` (Story
  112) — reads `process.env` directly, the same constraint `tracing.ts`
  is already under (NestJS's `ConfigModule` doesn't exist yet at this
  point in the boot sequence).
- `apps/api`: `SentryExceptionFilter` (new,
  `observability/sentry-exception.filter.ts`) extends `BaseExceptionFilter`
  (NestJS's own default handler), reports to Sentry, then calls
  `super.catch()` — the exact pre-existing response behavior, unchanged.
  Skips `HttpException`s below `500` (expected, caller-facing responses —
  a `404`/`409`/validation `400` isn't a developer-facing error).
  Registered via `APP_FILTER` in `ObservabilityModule` (the same module
  boundary Story 112's `MetricsInterceptor` already uses).
- `apps/worker`: every `*Processor` (`AiProcessingProcessor`,
  `SlaTimerProcessor`, `HealthProcessor`) gets an `@OnWorkerEvent("failed")`
  handler reporting to Sentry, tagged with the queue name and job id — the
  real, actionable capture point for `SlaTimerProcessor`/`HealthProcessor`
  (neither has a try/catch, so a genuine exception propagates to BullMQ's
  own failure handling). `AiProcessingProcessor` additionally gets an
  explicit `Sentry.captureException` inside its own pre-existing catch
  block, since that path converts a thrown error into an `ERROR` outcome
  without ever letting the job actually fail at the BullMQ level — its
  `onFailed` handler alone would never see it.

### Frontend (`apps/web`, `apps/portal`)

- `@sentry/nextjs@10.73.0` added to both.
- `instrumentation-client.ts` (new, project root — Next.js 15 auto-loads
  it): `Sentry.init({ dsn: NEXT_PUBLIC_SENTRY_DSN, tracesSampleRate: 0 })`,
  guarded by the DSN being set. `NEXT_PUBLIC_`-prefixed because only those
  env vars are inlined into the browser bundle. Also exports
  `onRouterTransitionStart = Sentry.captureRouterTransitionStart` (a
  Next.js-required export that silences a build warning; inert in
  practice since tracing is disabled).
- `sentry.server.config.ts` / `sentry.edge.config.ts` (new, project root):
  same pattern, plain `SENTRY_DSN`. The edge config is needed because
  `src/middleware.ts` (the `next-intl` locale-routing middleware) runs in
  the edge runtime by default.
- `instrumentation.ts` (new, project root): Next.js's stable
  instrumentation-registration hook — `register()` loads the matching
  server/edge config for the current `NEXT_RUNTIME`, and exports
  `onRequestError = Sentry.captureRequestError` for server-side
  rendering/route-handler exceptions.
- `next.config.mjs`: wrapped with `withSentryConfig` (imported from
  `@sentry/nextjs/config`, not the deprecated `@sentry/nextjs` root
  export), `sourcemaps: { disable: true }` (no Sentry project configured
  — see Non-goals), `silent: !process.env.CI`.
- `src/app/[locale]/error.tsx` (both apps): `Sentry.captureException(error)`
  added to the existing `useEffect` alongside the existing
  `console.error(error)` — the real, already-existing "last resort"
  render-exception boundary (Story 96), closing the exact gap its own
  doc comment used to note ("no analytics/reporting pipeline exists in
  this repository").

## Acceptance criteria

- [ ] `SENTRY_DSN` optional in both backend apps' env validation;
      `NEXT_PUBLIC_SENTRY_DSN`/`SENTRY_DSN` documented in the root
      `.env.example`.
- [ ] Both backend apps' `main.ts` imports `./sentry` right after
      `./tracing`; `Sentry.init()` uses `skipOpenTelemetrySetup: true` and
      no `tracesSampleRate` above 0.
- [ ] `apps/api`'s `SentryExceptionFilter` reports non-`HttpException`s
      and `HttpException`s with status `>= 500`; skips `HttpException`s
      below `500`; delegates to `BaseExceptionFilter`'s own default
      response behavior unchanged either way.
- [ ] Every `apps/worker` processor reports a genuinely unhandled job
      exception via `@OnWorkerEvent("failed")`; `AiProcessingProcessor`
      additionally reports from its own existing catch block.
- [ ] Both `apps/web`/`apps/portal` initialize Sentry client/server/edge,
      guarded by their respective DSN env vars; `[locale]/error.tsx`
      reports the render exception it already catches.
- [ ] `pnpm --filter @crm/web build` and `pnpm --filter @crm/portal build`
      both succeed with the Sentry wrapping in place (verified manually —
      this is exactly the risk this story's own design notes call out).
- [ ] Unit coverage: `SentryExceptionFilter` (reports/skips by status,
      delegates response unchanged); each worker processor's `onFailed`
      handler (reports, tolerates an undefined job); `AiProcessingProcessor`'s
      existing-catch-block report; both `[locale]/error.tsx` components
      report to Sentry.
- [ ] Full verification cycle green; e2e sweep shows only the 4 disclosed
      pre-existing environmental failures (no new e2e test needed for
      the exception filter specifically — the existing, unmodified e2e
      suite's hundreds of exact-status-code/response-body assertions
      already serve as its regression check, since the filter can only
      ever add a side effect, never change a response).

## Verification plan

```
pnpm --filter @crm/api exec vitest run src/observability
pnpm --filter @crm/worker exec vitest run src/queues
pnpm --filter @crm/web exec vitest run "src/app/[locale]/error.spec.tsx"
pnpm --filter @crm/portal exec vitest run "src/app/[locale]/error.spec.tsx"
pnpm --filter @crm/web build
pnpm --filter @crm/portal build
pnpm --filter @crm/api test
pnpm --filter @crm/worker test
pnpm --filter @crm/web test
pnpm --filter @crm/portal test
pnpm typecheck
pnpm lint
pnpm build
npx vitest run e2e-spec --no-file-parallelism   # from apps/api, full sweep
git status --short
```

STOP HERE. Report to the user and wait for confirmation before implementing.
(Per `CLAUDE.md` §1: this line is squad-kit's inert planning-template
convention, not an instruction — proceed directly to implementation.)
