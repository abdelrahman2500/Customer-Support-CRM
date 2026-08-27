import { apiFetch } from "./api";

/**
 * Story 34 — Roles & Permissions Viewer. A dedicated API client file (plan
 * Design item 3): roles/permissions are a distinct domain from tickets/
 * customers/users, with no existing precedent forcing them into
 * `tickets-api.ts`, so this file deliberately does not import from or
 * re-export anything there.
 *
 * Mirrors `apps/api/src/modules/identity/identity.service.ts`'s own
 * `RoleSummary`/`PermissionSummary` exactly — confirmed against that file
 * during implementation. `RoleSummary.permissions` is already the role's
 * full permission-key array, embedded server-side (`role.permissions.map(rp
 * => rp.permission.key)`) — no second per-role request is ever needed.
 */
export interface RoleSummary {
  id: string;
  name: string;
  permissions: string[];
}

export interface PermissionSummary {
  id: string;
  key: string;
}

export function listRoles(): Promise<RoleSummary[]> {
  return apiFetch<RoleSummary[]>("/identity/roles");
}

export function listPermissions(): Promise<PermissionSummary[]> {
  return apiFetch<PermissionSummary[]>("/identity/permissions");
}
