import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createRole,
  listManagedRoles,
  listPermissions,
  listRoles,
  setRolePermissions,
  updateRole,
} from "@/lib/roles-api";
import type { CreateRoleInput, SetRolePermissionsInput, UpdateRoleInput } from "@/lib/roles-api";

/**
 * Story 34 — dedicated roles/permissions hooks (plan Design item 3),
 * mirroring `use-sla-policies.ts`'s "own file, no import from
 * `use-tickets.ts`" convention.
 *
 * Story 46 adds a `["managed-roles"]` query (`includeInactive=true`),
 * distinct from the existing, unchanged `["roles"]` picker query — same
 * "picker vs. management" query-key split as `use-branches.ts` — plus
 * mutation hooks for create/rename/activate-deactivate/permission-assignment.
 * Mutations are never optimistic: only a successful response invalidates
 * `["managed-roles"]`, forcing a re-fetch of the real, authoritative state.
 */
export const managedRolesQueryKey = ["managed-roles"] as const;

/** UNCHANGED — key `["roles"]`, active-only. `CreateUserView`'s role picker
 * depends on this exact hook/key; do not alter. */
export function useRolesQuery() {
  return useQuery({ queryKey: ["roles"], queryFn: listRoles, staleTime: 5 * 60_000 });
}

/** Every role, active or not — backs the `/roles` management screen. */
export function useManagedRolesQuery() {
  return useQuery({ queryKey: managedRolesQueryKey, queryFn: listManagedRoles });
}

export function usePermissionsQuery() {
  return useQuery({ queryKey: ["permissions"], queryFn: listPermissions, staleTime: 5 * 60_000 });
}

/** Creates a new, zero-permission custom Role. Never applies optimistically:
 * only a successful `POST /identity/roles` invalidates `["managed-roles"]`. */
export function useCreateRoleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRoleInput) => createRole(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: managedRolesQueryKey });
    },
  });
}

/** Bound to one existing role's id, mirroring `useUpdateBranchMutation`/
 * `useUpdateDepartmentMutation` — called once per role row instance, never
 * inside a `.map()` (React's rules of hooks). Never applies optimistically. */
export function useUpdateRoleMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateRoleInput) => updateRole(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: managedRolesQueryKey });
    },
  });
}

/** Bound to one existing role's id. Full-replaces the role's permission
 * grants. Never applies optimistically. */
export function useSetRolePermissionsMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SetRolePermissionsInput) => setRolePermissions(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: managedRolesQueryKey });
    },
  });
}
