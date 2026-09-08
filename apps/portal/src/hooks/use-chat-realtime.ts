"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getAccessToken } from "@/lib/api";
import {
  acquireSharedSocket,
  joinRoomOnConnect,
  releaseSharedSocket,
} from "@/lib/realtime-connection";
import { chatAiResultQueryKey, chatMessagesQueryKey } from "./use-chat";

const AI_CHAT_MESSAGE_COMPLETED_EVENT = "ai.chat_message_completed";

/**
 * Story 80 — mirrors `use-portal-ticket-realtime.ts`'s connection/
 * room-join/cleanup shape exactly, joining the new `chat-session:{id}`
 * room (`RealtimeGateway.authorizeRoom`'s own new customer-only branch).
 * On `ai.chat_message_completed`, invalidates two exact keys — the
 * per-`logId` result (covers PENDING → SUCCESS/ERROR/DISABLED) and the
 * whole session's message list (a successful turn adds a new
 * `ChatMessage` row the list must pick up) — rather than merging, since
 * the event payload never carries the reply text itself.
 *
 * Batch 7 (UX audit) — acquires the shared, pooled socket connection
 * (`realtime-connection.ts`) instead of opening its own.
 */
export function useChatRealtime(sessionId: string | null): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!sessionId || !getAccessToken()) {
      return;
    }

    const socket = acquireSharedSocket();
    const unjoin = joinRoomOnConnect(socket, `chat-session:${sessionId}`);

    const handleAiChatMessageCompleted = (payload: {
      aiPromptLogId: string;
      chatSessionId: string;
      outcome: string;
    }) => {
      if (payload.chatSessionId !== sessionId) {
        return;
      }
      void queryClient.invalidateQueries({
        queryKey: chatAiResultQueryKey(sessionId, payload.aiPromptLogId),
      });
      void queryClient.invalidateQueries({ queryKey: chatMessagesQueryKey(sessionId) });
    };
    socket.on(AI_CHAT_MESSAGE_COMPLETED_EVENT, handleAiChatMessageCompleted);

    return () => {
      unjoin();
      socket.off(AI_CHAT_MESSAGE_COMPLETED_EVENT, handleAiChatMessageCompleted);
      releaseSharedSocket();
    };
  }, [sessionId, queryClient]);
}
