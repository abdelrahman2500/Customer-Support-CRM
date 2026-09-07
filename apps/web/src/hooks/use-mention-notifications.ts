"use client";

import { useEffect } from "react";
import { io } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { getAccessToken, getSocketBaseUrl } from "@/lib/api";
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
 */
export function useMentionNotifications(userId: string | null): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) {
      return;
    }
    const token = getAccessToken();
    if (!token) {
      return;
    }

    const socket = io(getSocketBaseUrl(), {
      auth: { token },
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      socket.emit("join", { room: `agent:${userId}:notifications` });
    });

    const handleMentioned = () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: unreadNotificationCountQueryKey });
    };
    socket.on(TICKET_MENTIONED_EVENT, handleMentioned);

    return () => {
      socket.off(TICKET_MENTIONED_EVENT, handleMentioned);
      socket.disconnect();
    };
  }, [userId, queryClient]);
}
