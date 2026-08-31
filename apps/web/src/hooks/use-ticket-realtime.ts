"use client";

import { useEffect } from "react";
import { io } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { getAccessToken, getSocketBaseUrl } from "@/lib/api";
import { invalidateTicketQueries } from "./use-tickets";
import { mergeChannelMessage, ticketMessagesQueryKey } from "./use-ticket-messages";
import { ticketAiResultQueryKey } from "./use-ticket-ai";
import type { ChannelMessageSummary } from "@/lib/ticket-messages-api";

const TICKET_UPDATED_EVENT = "ticket.updated";
const TICKET_ESCALATED_EVENT = "ticket.escalated";
const TICKET_NOTE_ADDED_EVENT = "ticket.note-added";
const CHANNEL_MESSAGE_CREATED_EVENT = "channel.message.created";
const AI_PROMPT_COMPLETED_EVENT = "ai.prompt_completed";

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
 *
 * Story 78 — a fourth subscribed event, `channel.message.created`
 * (Story 77), handled differently from the other three: rather than
 * invalidating and re-fetching the whole messages list on every chat
 * message (which would refetch on every keystroke-speed exchange), it merges
 * the message straight into `["ticket", id, "messages"]`'s cache via
 * `mergeChannelMessage` — the same merge the send-mutation's own `onSuccess`
 * uses, so a message this socket echoes back to its own sender (Story 77
 * broadcasts to the whole room, sender included) never appears twice. The
 * payload's own `ticketId` is checked against this hook's `ticketId` before
 * merging — belt-and-suspenders alongside the room-join itself already
 * guaranteeing this socket only ever receives this ticket's events.
 *
 * Story 79 — a fifth subscribed event, `ai.prompt_completed` (Story 76),
 * handled with an exact-key invalidate of `["ticket", id, "ai", logId]`
 * (`ticketAiResultQueryKey`) — see the handler's own comment below for why
 * this is a cache-merge situation.
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

    const handleChannelMessage = (payload: { ticketId: string; message: ChannelMessageSummary }) => {
      if (payload.ticketId !== ticketId) {
        return;
      }
      queryClient.setQueryData(
        ticketMessagesQueryKey(ticketId),
        (current: ChannelMessageSummary[] | undefined) => mergeChannelMessage(current, payload.message),
      );
    };
    socket.on(CHANNEL_MESSAGE_CREATED_EVENT, handleChannelMessage);

    // Story 79 — an exact-key invalidate (matching `handleUpdate`'s
    // original pattern above), not a cache-merge: an AI result is a
    // one-shot value fetched by its own known `logId`, not a growing
    // list, so invalidating and letting `useTicketAiResultQuery` refetch
    // is the correct, simpler, precedented choice.
    const handleAiPromptCompleted = (payload: {
      aiPromptLogId: string;
      ticketId: string;
      feature: string;
      outcome: string;
    }) => {
      if (payload.ticketId !== ticketId) {
        return;
      }
      void queryClient.invalidateQueries({
        queryKey: ticketAiResultQueryKey(ticketId, payload.aiPromptLogId),
      });
    };
    socket.on(AI_PROMPT_COMPLETED_EVENT, handleAiPromptCompleted);

    return () => {
      socket.off(TICKET_UPDATED_EVENT, handleUpdate);
      socket.off(TICKET_ESCALATED_EVENT, handleUpdate);
      socket.off(TICKET_NOTE_ADDED_EVENT, handleUpdate);
      socket.off(CHANNEL_MESSAGE_CREATED_EVENT, handleChannelMessage);
      socket.off(AI_PROMPT_COMPLETED_EVENT, handleAiPromptCompleted);
      socket.disconnect();
    };
  }, [ticketId, queryClient]);
}
