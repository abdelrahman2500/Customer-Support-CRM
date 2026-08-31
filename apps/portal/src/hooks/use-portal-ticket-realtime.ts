"use client";

import { useEffect } from "react";
import { io } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { getAccessToken, getSocketBaseUrl } from "@/lib/api";
import { mergeChannelMessage, myTicketMessagesQueryKey } from "./use-portal-tickets";
import type { ChannelMessageSummary } from "@/lib/tickets-api";

const CHANNEL_MESSAGE_CREATED_EVENT = "channel.message.created";

/**
 * Story 78 — the Customer Portal's first realtime subscription, mirroring
 * `apps/web/src/hooks/use-ticket-realtime.ts`'s connection/room-join/cleanup
 * shape exactly, joining the same `ticket:{id}` room Story 77 already
 * authorizes a customer-audience Portal JWT to join. Only
 * `channel.message.created` is subscribed to: `ticket.updated`/
 * `ticket.note-added`/`ticket.escalated`/`ai.prompt_completed` are either
 * agent-only (never reach this audience — `RealtimeGateway.emitToAgentsInRoom`)
 * or carry agent-side ticket-editing state this Portal surface has never
 * shown and is out of scope for this story to add.
 *
 * On a received message, merges it into `useMyTicketMessagesQuery`'s own
 * cache via `mergeChannelMessage` rather than invalidating/re-fetching —
 * same reasoning as `apps/web`'s own realtime handling of this event.
 * Connects on mount, disconnects on unmount/id change.
 */
export function usePortalTicketRealtime(ticketId: string): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      return;
    }

    const socket = io(getSocketBaseUrl(), {
      auth: { token },
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      socket.emit("join", { room: `ticket:${ticketId}` });
    });

    const handleChannelMessage = (payload: { ticketId: string; message: ChannelMessageSummary }) => {
      if (payload.ticketId !== ticketId) {
        return;
      }
      queryClient.setQueryData(
        myTicketMessagesQueryKey(ticketId),
        (current: ChannelMessageSummary[] | undefined) => mergeChannelMessage(current, payload.message),
      );
    };
    socket.on(CHANNEL_MESSAGE_CREATED_EVENT, handleChannelMessage);

    return () => {
      socket.off(CHANNEL_MESSAGE_CREATED_EVENT, handleChannelMessage);
      socket.disconnect();
    };
  }, [ticketId, queryClient]);
}
