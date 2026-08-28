import { apiFetch } from "./api";

/**
 * Story 45 — Branch & Department Management. A dedicated API client file
 * (same convention as `sla-policies-api.ts`/`business-hours-api.ts`): this
 * is a distinct concern from the active-only branch/department *pickers*
 * already served by `tickets-api.ts`'s `listBranches`/`listDepartments`
 * (consumed by `CreateUserView`/`CreateTicketView`/`TicketDetailView`,
 * which must only ever offer active branches/departments as selectable
 * values). This file deliberately does not import from or re-export
 * anything in `tickets-api.ts`, and `tickets-api.ts` is left completely
 * untouched.
 *
 * Confirmed against `apps/api/src/modules/identity/identity.service.ts` and
 * `users.controller.ts` during implementation:
 * - `GET /identity/branches?includeInactive=true|false` (default
 *   false/active-only) returns the caller's own branch only — never
 *   another branch (`TenantContext.requireBranchScope()`) — so it is
 *   always a zero-or-one-element array (zero only when `includeInactive`
 *   is omitted/false and the caller's branch happens to be inactive).
 * - `GET /identity/departments?includeInactive=true|false` returns every
 *   department in the caller's own branch, same scoping rule.
 * - `PATCH /identity/branches/:id` and `PATCH|POST /identity/departments*`
 *   all return `{ id: string }`, exactly like every other mutation
 *   endpoint in this codebase (see `SlaPolicySummary`'s sibling
 *   `updateSlaPolicy`/`tickets-api.ts`'s `updateTicket`, etc.) — never the
 *   full updated record. Callers that need the fresh, authoritative record
 *   re-fetch it via the query-invalidation the paired mutation hooks
 *   trigger (`use-branches.ts`), not from this response.
 */
export interface ManagedBranch {
  id: string;
  name: string;
  isActive: boolean;
}

/**
 * Note: the plan's sketch of this interface included a `timezone` field,
 * but `IdentityService#listBranches` only ever `select`s `{ id, name,
 * isActive }` — the GET endpoint never returns `timezone`, even though
 * `PATCH /identity/branches/:id` accepts one (`UpdateBranchDto#timezone`).
 * Deliberately omitted here rather than typed as an always-`undefined`
 * field the real response can never populate.
 */
export interface ManagedDepartment {
  id: string;
  branchId: string;
  name: string;
  isActive: boolean;
}

export interface UpdateBranchInput {
  name?: string;
  timezone?: string;
  isActive?: boolean;
}

export interface CreateDepartmentInput {
  name: string;
}

export interface UpdateDepartmentInput {
  name?: string;
  isActive?: boolean;
}

/**
 * The caller's own branch, including it even when inactive
 * (`includeInactive=true`) — this story's branch-settings view must be able
 * to show/reactivate a branch it has deactivated, unlike the active-only
 * picker `tickets-api.ts#listBranches` serves elsewhere. Returns `null`
 * in the (today, hypothetical) case where the endpoint returns no element.
 */
export async function getManagedBranch(): Promise<ManagedBranch | null> {
  const branches = await apiFetch<ManagedBranch[]>("/identity/branches?includeInactive=true");
  return branches[0] ?? null;
}

/** Every department in the caller's own branch, active or not
 * (`includeInactive=true`) — this story's department-settings view must be
 * able to show/reactivate a deactivated department. */
export function listManagedDepartments(): Promise<ManagedDepartment[]> {
  return apiFetch<ManagedDepartment[]>("/identity/departments?includeInactive=true");
}

/** Renames/(de)activates the caller's own branch. Returns `{ id }` only —
 * see this file's doc comment above. */
export function updateBranch(id: string, input: UpdateBranchInput): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/identity/branches/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/** Creates a department in the caller's own branch (`branchId` is derived
 * server-side, never sent). Returns `{ id }` only. */
export function createDepartment(input: CreateDepartmentInput): Promise<{ id: string }> {
  return apiFetch<{ id: string }>("/identity/departments", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Renames/(de)activates a department in the caller's own branch. Returns
 * `{ id }` only. */
export function updateDepartment(
  id: string,
  input: UpdateDepartmentInput,
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/identity/departments/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
