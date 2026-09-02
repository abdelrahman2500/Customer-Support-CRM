import * as Sentry from "@sentry/nextjs";

/**
 * Story 113 — edge-runtime half of this app's Sentry setup, loaded via
 * `instrumentation.ts`'s `register()`. Needed because `src/middleware.ts`
 * (the `next-intl` locale-routing middleware) runs in the edge runtime by
 * default. See `instrumentation-client.ts`'s own doc comment for the
 * "unset is a valid, expected state"/`tracesSampleRate: 0` rationale.
 */
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0,
  });
}
