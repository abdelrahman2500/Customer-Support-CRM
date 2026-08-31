import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getChatAiResult,
  getChatMessages,
  sendChatMessage,
  startChatSession,
} from "@/lib/chat-api";

/**
 * Story 80 — mirrors `apps/web/src/hooks/use-ticket-ai.ts`'s shape:
 * `chatAiResultQueryKey` is a distinct per-`logId` key so two messages
 * sent back-to-back never collide. `chatMessagesQueryKey` is a
 * per-session key, invalidated (not merged) once a turn resolves — see
 * `use-chat-realtime.ts`.
 */
export const chatMessagesQueryKey = (sessionId: string) =>
  ["chat-session", sessionId, "messages"] as const;

export const chatAiResultQueryKey = (sessionId: string, logId: string) =>
  ["chat-session", sessionId, "ai", logId] as const;

export function useChatMessagesQuery(sessionId: string | null) {
  return useQuery({
    queryKey: chatMessagesQueryKey(sessionId ?? ""),
    queryFn: () => getChatMessages(sessionId as string),
    enabled: sessionId !== null,
  });
}

export function useChatAiResultQuery(sessionId: string | null, logId: string | null) {
  return useQuery({
    queryKey: chatAiResultQueryKey(sessionId ?? "", logId ?? ""),
    queryFn: () => getChatAiResult(sessionId as string, logId as string),
    enabled: sessionId !== null && logId !== null,
  });
}

export function useStartChatSessionMutation() {
  return useMutation({ mutationFn: startChatSession });
}

export function useSendChatMessageMutation(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => sendChatMessage(sessionId, body),
    onSuccess: () => {
      // The customer's own message is now persisted — refetch so it
      // appears immediately, without waiting for the assistant's turn.
      void queryClient.invalidateQueries({ queryKey: chatMessagesQueryKey(sessionId) });
    },
  });
}
