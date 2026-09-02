import * as Sentry from "@sentry/node";

/**
 * Story 113 — docs/architecture/11-quality-and-operations.md: "Sentry or
 * self-hosted GlitchTip captures unhandled frontend and backend
 * exceptions." Imported as `main.ts`'s second line (right after
 * `./tracing`, before `reflect-metadata`).
 *
 * A no-op when `SENTRY_DSN` is unset. `skipOpenTelemetrySetup: true` is
 * the critical setting here — this app already has its own complete
 * `NodeSDK` (`./tracing`), and Sentry's SDK is itself built on
 * OpenTelemetry; without this flag it would install a second, competing
 * set of global OTel providers. Combined with never setting
 * `tracesSampleRate`, this scopes Sentry to pure exception capture, not a
 * second tracing system.
 *
 * Must stay behaviorally aligned with `apps/api/src/sentry.ts`
 * (deliberately duplicated — see `common/logging/correlation-id.store.ts`'s
 * own doc comment on this repo's "no cross-app shared-runtime mechanism"
 * convention, already applied to Stories 111/112).
 *
 * `apps/worker` has no HTTP layer to hang a global exception filter off
 * of — each `*Processor` reports its own job failures directly (see
 * `AiProcessingProcessor`'s and `SlaTimerProcessor`'s own doc comments on
 * their `@OnWorkerEvent("failed")` handlers / explicit
 * `Sentry.captureException` calls).
 */
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    skipOpenTelemetrySetup: true,
  });
}
