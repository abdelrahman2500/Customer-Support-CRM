import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Story 111 — a thin wrapper around Node's built-in `AsyncLocalStorage`,
 * not a new dependency. `RequestIdMiddleware` calls `run()` once per
 * request, wrapping `next()`; everything downstream for the lifetime of
 * that request/response cycle (middleware, guards, services, and — the
 * whole point — a BullMQ producer's `enqueue()` call happening later in
 * the same request) can call `get()` to read the current correlation id
 * with no additional DI wiring.
 *
 * Deliberately duplicated in `apps/worker` (see
 * `apps/worker/src/common/logging/correlation-id.store.ts`) rather than
 * shared via `packages/shared` — this codebase already has an explicit
 * "no cross-app shared-constants/runtime mechanism" convention (see
 * `AiProcessingProducer`'s own doc comment on the duplicated
 * `AI_PROCESSING_QUEUE` literal), and `packages/shared` today holds only
 * pure JWT/auth type contracts, not runtime infrastructure.
 */
const store = new AsyncLocalStorage<string>();

export const CorrelationIdStore = {
  run<T>(id: string, fn: () => T): T {
    return store.run(id, fn);
  },
  get(): string | undefined {
    return store.getStore();
  },
};
