type Listener = () => void;

const listeners = new Set<Listener>();

/**
 * Story 95 — Authentication Recovery.
 *
 * Recon confirmed that when `apiFetch`'s 401 handling reaches a genuinely
 * unrecoverable state — a real refresh attempt failed, or a request retried
 * with a freshly refreshed token still 401s — nothing above it ever
 * navigated anywhere: the protected page's shell kept rendering, showing
 * only its own local error state, until the user happened to trigger a
 * fresh navigation and the server-side layout guard finally caught it.
 *
 * `apiFetch` calls `emitAuthExpired()` at exactly those two points (never on
 * an ordinary 403, and never before a refresh has actually been attempted).
 * `AuthRecoveryListener` is the one production subscriber, mounted once
 * above every route group, so the redirect fires regardless of which page's
 * request happened to surface the failure.
 *
 * A plain module-level pub/sub rather than a DOM `CustomEvent` — this stays
 * framework-agnostic (no `window` dependency, so `apiFetch` itself needs no
 * environment check) and trivially mockable in tests, mirroring how
 * `clearAccessToken`/`logout` are already mocked as plain functions.
 */
export function emitAuthExpired(): void {
  for (const listener of listeners) {
    listener();
  }
}

/** Subscribes to `emitAuthExpired()`; returns an unsubscribe function. */
export function onAuthExpired(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
