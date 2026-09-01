import type { QueryClient } from "@tanstack/react-query";

/**
 * Story 95 — Authentication Recovery.
 *
 * A plain module-level reference to the single, app-wide `QueryClient`
 * `QueryProvider` creates. A couple of call sites need to clear every
 * cached query when a session ends — `AuthRecoveryListener` (an
 * unrecoverable auth failure) and `WorkspaceNav`'s sign-out button (an
 * explicit one) — so that a different user signing in next, in the same
 * tab, never sees a flash of the previous session's cached data before
 * their own queries refetch (a gap this story's own recon identified: the
 * `QueryClient` is a single long-lived instance that survives a soft
 * sign-out → sign-in navigation, and neither previously cleared it).
 *
 * Registered once by `QueryProvider` itself; every other caller only ever
 * reads it. Kept as a plain function (not a hook) so callers that would
 * rather not require a `QueryClientProvider` ancestor just to clear cached
 * data can import it exactly like `clearAccessToken`.
 */
let queryClient: QueryClient | null = null;

export function registerQueryClient(client: QueryClient): void {
  queryClient = client;
}

/** Clears every cached query/mutation. No-op if no client has registered yet. */
export function clearQueryCache(): void {
  queryClient?.clear();
}
