import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiKey, listApiKeys, revokeApiKey } from "@/lib/api-keys-api";
import type { CreateApiKeyInput } from "@/lib/api-keys-api";

/** RM-22 — dedicated api-keys hooks, mirroring
 * `use-webhook-subscriptions.ts`'s never-optimistic convention exactly. */
export const apiKeysQueryKey = ["api-keys"] as const;

export function useApiKeysQuery() {
  return useQuery({ queryKey: apiKeysQueryKey, queryFn: listApiKeys });
}

export function useCreateApiKeyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateApiKeyInput) => createApiKey(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: apiKeysQueryKey });
    },
  });
}

export function useRevokeApiKeyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => revokeApiKey(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: apiKeysQueryKey });
    },
  });
}
