import { useQuery } from "@tanstack/react-query";
import { listPermissions, listRoles } from "@/lib/roles-api";

/**
 * Story 34 — dedicated roles/permissions hooks (plan Design item 3),
 * mirroring `use-sla-policies.ts`'s "own file, no import from
 * `use-tickets.ts`" convention. Read-only — no mutation exists anywhere on
 * this screen, so there is nothing to invalidate; `staleTime` matches
 * `useUsersQuery`'s existing convention for infrequently-changing reference
 * data.
 */
export function useRolesQuery() {
  return useQuery({ queryKey: ["roles"], queryFn: listRoles, staleTime: 5 * 60_000 });
}

export function usePermissionsQuery() {
  return useQuery({ queryKey: ["permissions"], queryFn: listPermissions, staleTime: 5 * 60_000 });
}
