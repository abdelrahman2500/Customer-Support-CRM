import * as Sentry from "@sentry/nextjs";

/**
 * Story 113 — Next.js's own instrumentation-registration hook. Mirrors
 * `apps/web/instrumentation.ts` exactly — see that file's own doc
 * comment.
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
