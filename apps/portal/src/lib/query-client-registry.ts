import type { QueryClient } from "@tanstack/react-query";

/**
 * Story 95 — Authentication Recovery. Mirrors
 * `apps/web/src/lib/query-client-registry.ts` exactly — see that file's doc
 * comment for the full rationale.
 */
let queryClient: QueryClient | null = null;

export function registerQueryClient(client: QueryClient): void {
  queryClient = client;
}

/** Clears every cached query/mutation. No-op if no client has registered yet. */
export function clearQueryCache(): void {
  queryClient?.clear();
}
