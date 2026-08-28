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
 *
 * Story 46 adds `isActive` to `RoleSummary` (additive) and Role mutation:
 * `createRole`/`updateRole`/`setRolePermissions`, plus `listManagedRoles`
 * (`includeInactive=true`) as a distinct query from the existing, unchanged
 * `listRoles()` (active-only, still used by `CreateUserView`'s role
 * picker) — same "picker vs. management" split as `branches-api.ts`.
 */
export interface RoleSummary {
  id: string;
  name: string;
  permissions: string[];
  isActive: boolean;
}

export interface PermissionSummary {
  id: string;
  key: string;
}

export interface CreateRoleInput {
  name: string;
}

export interface UpdateRoleInput {
  name?: string;
  isActive?: boolean;
}

export interface SetRolePermissionsInput {
  permissionKeys: string[];
}

/** Active-only roles, unchanged since Story 34 — do not alter this call
 * signature or behavior, `CreateUserView`'s role picker depends on it. */
export function listRoles(): Promise<RoleSummary[]> {
  return apiFetch<RoleSummary[]>("/identity/roles");
}

/** Every role, active or not (`includeInactive=true`) — this story's
 * management screen must be able to show/reactivate a deactivated role. */
export function listManagedRoles(): Promise<RoleSummary[]> {
  return apiFetch<RoleSummary[]>("/identity/roles?includeInactive=true");
}

export function listPermissions(): Promise<PermissionSummary[]> {
  return apiFetch<PermissionSummary[]>("/identity/permissions");
}

/** Creates a new, zero-permission custom Role. Returns `{ id }` only —
 * permissions are assigned via a separate `setRolePermissions` call. */
export function createRole(input: CreateRoleInput): Promise<{ id: string }> {
  return apiFetch<{ id: string }>("/identity/roles", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Renames/(de)activates a Role. Rejected (400) by the backend for the two
 * protected roles, `SuperAdmin`/`Agent`. Returns `{ id }` only. */
export function updateRole(id: string, input: UpdateRoleInput): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/identity/roles/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/** Full-replaces a Role's permission grants with `permissionKeys` — allowed
 * on every role including `SuperAdmin`/`Agent`. Returns `{ id }` only. */
export function setRolePermissions(
  id: string,
  input: SetRolePermissionsInput,
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/identity/roles/${id}/permissions`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
