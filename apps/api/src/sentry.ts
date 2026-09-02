import * as Sentry from "@sentry/node";

/**
 * Story 113 — docs/architecture/11-quality-and-operations.md: "Sentry or
 * self-hosted GlitchTip captures unhandled frontend and backend
 * exceptions." Imported as `main.ts`'s second line (right after
 * `./tracing`, before `reflect-metadata`) so it's active before anything
 * else boots.
 *
 * A no-op when `SENTRY_DSN` is unset — the same "unset is a valid,
 * expected state" precedent `env.validation.ts`'s own doc comment
 * describes; unhandled exceptions are still caught and logged via
 * `SentryExceptionFilter`/`PinoLoggerService` either way. Reads
 * `process.env` directly rather than the validated `EnvConfig` (NestJS's
 * `ConfigModule` doesn't exist yet at this point in the boot sequence —
 * the same constraint `tracing.ts` is already under).
 *
 * `skipOpenTelemetrySetup: true` is the critical setting here: this
 * app already has its own complete `NodeSDK` (`./tracing`), and Sentry's
 * SDK is itself built on OpenTelemetry — without this flag, Sentry would
 * install a second, competing set of global OTel providers/context
 * manager. Combined with never setting `tracesSampleRate` (defaults to
 * disabled), this scopes Sentry to pure exception capture, deliberately
 * not a second tracing system — `tracing.ts` already covers that
 * Observability bullet.
 *
 * Deliberately `@sentry/node`, not `@sentry/nestjs`: the latter wires up
 * its own additional Nest-specific OpenTelemetry auto-instrumentation,
 * reintroducing the exact collision risk `skipOpenTelemetrySetup` avoids.
 * `SentryExceptionFilter` (`observability/sentry-exception.filter.ts`) is
 * this app's own small, explicit integration point instead.
 */
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    skipOpenTelemetrySetup: true,
  });
}
