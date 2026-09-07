/**
 * RM-22 — the scope vocabulary an API key's `scopes` may be drawn from.
 * Deliberately its own small catalog, not the full human RBAC
 * `PERMISSION_CATALOG` (`prisma/seed.ts`): that catalog includes plenty of
 * keys (`user:create`, `role:assign-permissions`, ...) that make no sense
 * as a machine-to-machine capability, and reusing it wholesale would let a
 * key be issued with a scope no `@AllowApiKey()` route will ever check.
 * Finer-grained than the single human `integration:manage` permission
 * (RM-20) on purpose — a machine caller plausibly needs read-only access
 * far more often than write access.
 */
export const API_KEY_SCOPES = ["integration:read", "integration:write"] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];
