"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getAccessToken } from "@/lib/api";
import {
  acquireSharedSocket,
  joinRoomOnConnect,
  releaseSharedSocket,
} from "@/lib/realtime-connection";
import { unreadNotificationCountQueryKey } from "./use-notifications";

const TICKET_MENTIONED_EVENT = "ticket.mentioned";

/**
 * RM-06 — mirrors `useTaskReminders`'s exact architecture: owns
 * `useQueryClient()` itself and invalidates the notifications cache
 * directly on the event, rather than exposing an `onEvent` callback —
 * there is exactly one thing to do with this event (refresh the
 * notification bell/history), so there is nothing for a caller-supplied
 * callback to add. Joins the caller's own `agent:{userId}:notifications`
 * room (`RealtimeGateway.authorizeRoom`'s own `agent:(.+):notifications`
 * case — own id only, mirrors `agent:(.+):tasks`: a mention notification
 * is strictly personal). Connects on mount, disconnects on unmount/id
 * change. Invalidates both `["notifications"]` (every filter/page variant
 * — the same partial-match convention `useCreateArticleMutation` etc.
 * already rely on) and the unread-count key, so `WorkspaceNav`'s own
 * badge (its mount point — see that component) and the notification
 * history screen both pick up a new mention without a manual refresh.
 *
 * Batch 7 (UX audit) — acquires the shared, pooled socket connection
 * (`realtime-connection.ts`) instead of opening its own.
 */
export function useMentionNotifications(userId: string | null): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId || !getAccessToken()) {
      return;
    }

    const socket = acquireSharedSocket();
    const unjoin = joinRoomOnConnect(socket, `agent:${userId}:notifications`);

    const handleMentioned = () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: unreadNotificationCountQueryKey });
    };
    socket.on(TICKET_MENTIONED_EVENT, handleMentioned);

    return () => {
      unjoin();
      socket.off(TICKET_MENTIONED_EVENT, handleMentioned);
      releaseSharedSocket();
    };
  }, [userId, queryClient]);
}
