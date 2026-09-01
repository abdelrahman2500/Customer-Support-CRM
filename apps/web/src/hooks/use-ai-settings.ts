import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAiSettings, updateAiSettings } from "@/lib/ai-settings-api";
import type { UpdateAiSettingsInput } from "@/lib/ai-settings-api";

/**
 * Story 81 — dedicated AI settings hooks, mirroring `use-branding.ts`'s
 * own file/convention.
 */
export const aiSettingsQueryKey = ["ai-settings"] as const;

export function useAiSettingsQuery() {
  return useQuery({ queryKey: aiSettingsQueryKey, queryFn: getAiSettings });
}

export function useUpdateAiSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateAiSettingsInput) => updateAiSettings(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: aiSettingsQueryKey });
    },
  });
}
