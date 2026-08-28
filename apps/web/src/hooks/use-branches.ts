import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createDepartment,
  getManagedBranch,
  listManagedDepartments,
  updateBranch,
  updateDepartment,
} from "@/lib/branches-api";
import type {
  CreateDepartmentInput,
  UpdateBranchInput,
  UpdateDepartmentInput,
} from "@/lib/branches-api";

/**
 * Story 45 — dedicated branch/department *management* hooks (own file, no
 * import from `use-tickets.ts`), mirroring `use-sla-policies.ts`'s
 * never-optimistic convention exactly.
 *
 * Query keys are deliberately distinct from `use-tickets.ts`'s existing
 * `["branches"]`/`["departments"]` (which back the active-only
 * branch/department *pickers* used by `CreateUserView`/`CreateTicketView`/
 * `TicketDetailView`): this story's `includeInactive=true` queries return a
 * different shape of the same underlying resource (inactive rows included),
 * and there is no existing precedent in this codebase for a single query
 * key serving two different filter shapes of one resource — so, as with
 * every other domain here, a new resource gets its own key rather than
 * risk silently sharing/polluting the picker's cached, active-only result.
 */
export const managedBranchQueryKey = ["managed-branch"] as const;
export const managedDepartmentsQueryKey = ["managed-departments"] as const;

export function useManagedBranchQuery() {
  return useQuery({
    queryKey: managedBranchQueryKey,
    queryFn: getManagedBranch,
  });
}

export function useManagedDepartmentsQuery() {
  return useQuery({
    queryKey: managedDepartmentsQueryKey,
    queryFn: listManagedDepartments,
  });
}

/**
 * Never applies optimistically: only a successful `PATCH
 * /identity/branches/:id` invalidates `["managed-branch"]`, forcing a
 * re-fetch of the real, authoritative record — the mutation response itself
 * is only `{ id }` (see `branches-api.ts`), never the updated fields.
 */
export function useUpdateBranchMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateBranchInput) => updateBranch(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: managedBranchQueryKey });
    },
  });
}

/**
 * Never applies optimistically: only a successful `POST
 * /identity/departments` invalidates `["managed-departments"]`, forcing the
 * list to re-fetch the real, authoritative state.
 */
export function useCreateDepartmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDepartmentInput) => createDepartment(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: managedDepartmentsQueryKey });
    },
  });
}

/** Bound to one existing department's id, mirroring
 * `useUpdateSlaPolicyMutation`/`useUpdateBusinessHoursExceptionMutation` —
 * called once per department row instance, never inside a `.map()` (React's
 * rules of hooks). Never applies optimistically. */
export function useUpdateDepartmentMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateDepartmentInput) => updateDepartment(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: managedDepartmentsQueryKey });
    },
  });
}
