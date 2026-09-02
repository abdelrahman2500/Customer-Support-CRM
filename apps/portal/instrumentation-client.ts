import * as Sentry from "@sentry/nextjs";

/**
 * Story 113 — docs/architecture/11-quality-and-operations.md: "Sentry or
 * self-hosted GlitchTip captures unhandled frontend and backend
 * exceptions." Next.js 15's App Router auto-loads this file (no manual
 * registration needed) for client-side (browser) instrumentation — the
 * counterpart to `instrumentation.ts` (server/edge).
 *
 * Must stay behaviorally aligned with `apps/web/instrumentation-client.ts`
 * (deliberately duplicated, mirroring this repository's own established
 * "no cross-app shared-runtime mechanism" convention — see Stories
 * 111/112). `NEXT_PUBLIC_SENTRY_DSN`, not `SENTRY_DSN` — only
 * `NEXT_PUBLIC_*`-prefixed env vars are inlined into the browser bundle.
 * A no-op when unset. `tracesSampleRate: 0` — pure exception capture, not
 * a second tracing/performance-monitoring system.
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
