"use client";

import { useEffect } from "react";
import { io } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { getAccessToken, getSocketBaseUrl } from "@/lib/api";
import { invalidateTicketQueries } from "./use-tickets";

const TICKET_UPDATED_EVENT = "ticket.updated";
const TICKET_ESCALATED_EVENT = "ticket.escalated";
const TICKET_NOTE_ADDED_EVENT = "ticket.note-added";

/**
 * Story 23, plan Design item 8 — Ticket Detail's *only* realtime
 * subscription: joins the existing `ticket:{id}` room (Story 20's
 * `RealtimeGateway`/`TicketRealtimeListener`, unmodified) and, on any of the
 * events that room relays, invalidates this ticket's TanStack Query cache
 * entries rather than trusting the socket payload as the source of truth —
 * the same "re-fetch by id" caution the backend's own listeners already use.
 * Does **not** join `branch:{id}:notifications` (Story 22) or any
 * `agent:{id}:presence` room — both explicitly out of scope for this story.
 * Connects on mount, disconnects on unmount/id change.
 *
 * Story 50 — `ticket.note-added` added as a third subscribed event, reusing
 * the same `handleUpdate` handler unchanged (Task 12).
 */
export function useTicketRealtime(ticketId: string): void {
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

    const handleUpdate = () => invalidateTicketQueries(queryClient, ticketId);
    socket.on(TICKET_UPDATED_EVENT, handleUpdate);
    socket.on(TICKET_ESCALATED_EVENT, handleUpdate);
    socket.on(TICKET_NOTE_ADDED_EVENT, handleUpdate);

    return () => {
      socket.off(TICKET_UPDATED_EVENT, handleUpdate);
      socket.off(TICKET_ESCALATED_EVENT, handleUpdate);
      socket.off(TICKET_NOTE_ADDED_EVENT, handleUpdate);
      socket.disconnect();
    };
  }, [ticketId, queryClient]);
}
