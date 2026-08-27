import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createSlaPolicy,
  getSlaPolicy,
  listSlaPolicies,
  updateSlaPolicy,
} from "@/lib/sla-policies-api";
import type { CreateSlaPolicyInput, UpdateSlaPolicyInput } from "@/lib/sla-policies-api";

/**
 * Story 31 — dedicated SLA policy hooks (plan Design item 4), mirroring
 * `use-tickets.ts`'s never-optimistic convention exactly but living in their
 * own file — no import from `use-tickets.ts`.
 */
export const slaPoliciesQueryKey = ["sla-policies"] as const;
export const slaPolicyQueryKey = (id: string) => ["sla-policies", id] as const;

export function useSlaPoliciesQuery() {
  return useQuery({
    queryKey: slaPoliciesQueryKey,
    queryFn: listSlaPolicies,
  });
}

export function useSlaPolicyQuery(id: string) {
  return useQuery({
    queryKey: slaPolicyQueryKey(id),
    queryFn: () => getSlaPolicy(id),
  });
}

/**
 * Never applies optimistically (same rule every other mutation hook in this
 * codebase follows): only a successful `POST /sla-policies` invalidates
 * `["sla-policies"]`, forcing the list to re-fetch the real, authoritative
 * state.
 */
export function useCreateSlaPolicyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSlaPolicyInput) => createSlaPolicy(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: slaPoliciesQueryKey });
    },
  });
}

/**
 * Never applies optimistically: only a successful `PATCH /sla-policies/:id`
 * invalidates both this one policy's query and the branch-wide list —
 * a rejected mutation leaves the cache untouched and the caller renders
 * `mutation.error`, reverting its own local draft state.
 */
export function useUpdateSlaPolicyMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateSlaPolicyInput) => updateSlaPolicy(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: slaPolicyQueryKey(id) });
      void queryClient.invalidateQueries({ queryKey: slaPoliciesQueryKey });
    },
  });
}
