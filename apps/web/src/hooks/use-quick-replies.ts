import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createQuickReply,
  listQuickReplies,
  updateQuickReply,
} from "@/lib/quick-replies-api";
import type { CreateQuickReplyInput, UpdateQuickReplyInput } from "@/lib/quick-replies-api";

/**
 * Story 91 — dedicated quick-replies hooks, mirroring
 * `use-automation-rules.ts`'s never-optimistic convention exactly but
 * living in their own file.
 */
export const quickRepliesQueryKey = ["quick-replies"] as const;

export function useQuickRepliesQuery() {
  return useQuery({ queryKey: quickRepliesQueryKey, queryFn: listQuickReplies });
}

export function useCreateQuickReplyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateQuickReplyInput) => createQuickReply(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: quickRepliesQueryKey });
    },
  });
}

export function useUpdateQuickReplyMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateQuickReplyInput) => updateQuickReply(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: quickRepliesQueryKey });
    },
  });
}
