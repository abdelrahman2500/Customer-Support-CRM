import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Story 111 — a thin wrapper around Node's built-in `AsyncLocalStorage`,
 * not a new dependency. `AiProcessingProcessor.process()` calls `run()`
 * once per job, wrapping the job's own processing; every log line emitted
 * during that job (via `PinoLoggerService`) reads `get()` to merge in the
 * same correlation id the enqueuing API request used.
 *
 * Must stay identical to `apps/api/src/common/logging/correlation-id.store.ts`
 * — deliberately duplicated, not shared via `packages/shared`: this
 * codebase already has an explicit "no cross-app shared-constants/runtime
 * mechanism" convention (see `AiProcessingProducer`'s own doc comment on
 * the duplicated `AI_PROCESSING_QUEUE` literal), and `packages/shared`
 * today holds only pure JWT/auth type contracts, not runtime
 * infrastructure.
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
