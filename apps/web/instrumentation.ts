import * as Sentry from "@sentry/nextjs";

/**
 * Story 113 — Next.js's own instrumentation-registration hook (stable,
 * no experimental flag needed on Next.js 15). Loads the right Sentry init
 * for whichever runtime this server process is actually running under,
 * and wires `onRequestError` so Next.js reports a server-side rendering/
 * route-handler exception the same way `[locale]/error.tsx` reports a
 * client-side render exception (see that file's own doc comment).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
