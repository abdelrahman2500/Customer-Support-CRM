type Listener = () => void;

const listeners = new Set<Listener>();

/**
 * Story 95 — Authentication Recovery. Mirrors `apps/web/src/lib/auth-events.ts`
 * exactly — see that file's doc comment for the full rationale.
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
