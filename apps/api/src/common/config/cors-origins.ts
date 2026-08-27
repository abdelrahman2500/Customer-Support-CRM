/**
 * Story 23 — parses the `CORS_ORIGINS` environment variable into the origin
 * list both `main.ts` (REST) and `RedisIoAdapter` (Socket.IO) pass to their
 * respective `cors` options. A small, pure, independently-unit-testable
 * helper — the same "extract the pure piece" convention this codebase
 * already uses (e.g. `apps/worker/src/queues/sla-transition-evaluator.ts`).
 *
 * Fails closed: an unset/empty value parses to `[]`, which rejects every
 * cross-origin request — identical to this API's actual behavior before
 * this story (no CORS configured at all). Nothing is allowed unless a
 * deployment explicitly opts in.
 */
export function parseCorsOrigins(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
