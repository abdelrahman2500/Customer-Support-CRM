import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getBranding, updateBranding } from "@/lib/branding-api";
import type { UpdateBrandingInput } from "@/lib/branding-api";

/**
 * Story 62 — dedicated branding hooks, mirroring `use-automation-rules.ts`'s
 * own file/convention.
 */
export const brandingQueryKey = ["branding"] as const;

export function useBrandingQuery() {
  return useQuery({ queryKey: brandingQueryKey, queryFn: getBranding });
}

export function useUpdateBrandingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateBrandingInput) => updateBranding(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: brandingQueryKey });
    },
  });
}
