import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAutomationRule,
  listAutomationRules,
  updateAutomationRule,
} from "@/lib/automation-rules-api";
import type {
  CreateAutomationRuleInput,
  UpdateAutomationRuleInput,
} from "@/lib/automation-rules-api";

/**
 * Story 57 — dedicated automation-rules hooks, mirroring
 * `use-sla-policies.ts`'s never-optimistic convention exactly but living in
 * their own file.
 */
export const automationRulesQueryKey = ["automation-rules"] as const;

export function useAutomationRulesQuery() {
  return useQuery({ queryKey: automationRulesQueryKey, queryFn: listAutomationRules });
}

export function useCreateAutomationRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAutomationRuleInput) => createAutomationRule(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: automationRulesQueryKey });
    },
  });
}

export function useUpdateAutomationRuleMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateAutomationRuleInput) => updateAutomationRule(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: automationRulesQueryKey });
    },
  });
}
