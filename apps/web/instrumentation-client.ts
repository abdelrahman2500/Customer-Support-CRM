import * as Sentry from "@sentry/nextjs";

/**
 * Story 113 — docs/architecture/11-quality-and-operations.md: "Sentry or
 * self-hosted GlitchTip captures unhandled frontend and backend
 * exceptions." Next.js 15's App Router auto-loads this file (no manual
 * registration needed) for client-side (browser) instrumentation — the
 * counterpart to `instrumentation.ts` (server/edge).
 *
 * `NEXT_PUBLIC_SENTRY_DSN`, not `SENTRY_DSN`: only `NEXT_PUBLIC_*`-prefixed
 * env vars are inlined into the browser bundle at build time; a plain
 * `SENTRY_DSN` would be `undefined` in client code. A no-op when unset —
 * the same "unset is a valid, expected state" precedent
 * `apps/api/src/common/config/env.validation.ts`'s own `SENTRY_DSN`
 * uses.
 *
 * `tracesSampleRate: 0` (never enabled) — this scopes Sentry to pure
 * exception capture, not a second performance-monitoring/tracing system;
 * no Session Replay either — both are additional, separate features this
 * story's own narrower goal ("captures unhandled exceptions") doesn't
 * need.
 */
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0,
  });
}

// Required export for Next.js App Router navigation instrumentation —
// a no-op in practice here since `tracesSampleRate: 0` means nothing is
// ever actually captured, but its absence prints a build-time warning.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
