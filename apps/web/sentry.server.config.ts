import * as Sentry from "@sentry/nextjs";

/**
 * Story 113 — server-runtime half of this app's Sentry setup, loaded via
 * `instrumentation.ts`'s `register()`. See `instrumentation-client.ts`'s
 * own doc comment for the "unset is a valid, expected state"/
 * `tracesSampleRate: 0` rationale — identical here, just the plain
 * `SENTRY_DSN` (server code, never bundled into the browser) instead of
 * `NEXT_PUBLIC_SENTRY_DSN`.
 */
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0,
  });
}
