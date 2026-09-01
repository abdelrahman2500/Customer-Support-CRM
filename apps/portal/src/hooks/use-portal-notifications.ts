"use client";

import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { getAccessToken, getSocketBaseUrl } from "@/lib/api";
import type {
  PortalNotificationEventType,
  PortalNotificationPayload,
} from "@/lib/notifications-store";

const TICKET_UPDATED_EVENT = "ticket.updated";
const CHANNEL_MESSAGE_CREATED_EVENT = "channel.message.created";

/**
 * Story 86 — the Customer Portal's second realtime subscription (after
 * `usePortalTicketRealtime`, Story 78), mirroring `apps/web`'s
 * `useBranchNotifications` shape exactly: joins the new
 * `customer:{customerId}:notifications` room (`RealtimeGateway`'s own
 * Story 86 branch, `CustomerNotificationRealtimeListener`) once per
 * session and forwards exactly the two events that room relays, verbatim
 * — no envelope, no transformation, no new event names.
 *
 * Mounted once in `(customer)/layout.tsx` (see `PortalNotifications`),
 * never per-page — independent of, and never joins, `ticket:{id}`.
 *
 * `onEvent` is read through a ref rather than being an effect dependency,
 * for the identical reason `useBranchNotifications` does this: the caller
 * passes the notifications store's `add` action (a stable reference), but
 * this hook must not re-establish the socket connection merely because a
 * parent re-render produced a new inline callback. Only `customerId`
 * changing re-establishes the connection.
 */
export function usePortalNotifications(
  customerId: string | null,
  onEvent: (eventType: PortalNotificationEventType, payload: PortalNotificationPayload) => void,
): void {
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!customerId) {
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

    // `connect` fires on every (re)connection, including socket.io's own
    // automatic reconnects — re-joining here is what makes reconnects safe
    // without any extra bookkeeping, mirroring `useBranchNotifications`.
    socket.on("connect", () => {
      socket.emit("join", { room: `customer:${customerId}:notifications` });
    });

    const handleTicketUpdated = (payload: PortalNotificationPayload) =>
      onEventRef.current(TICKET_UPDATED_EVENT, payload);
    const handleChannelMessageCreated = (payload: PortalNotificationPayload) =>
      onEventRef.current(CHANNEL_MESSAGE_CREATED_EVENT, payload);

    socket.on(TICKET_UPDATED_EVENT, handleTicketUpdated);
    socket.on(CHANNEL_MESSAGE_CREATED_EVENT, handleChannelMessageCreated);

    return () => {
      socket.off(TICKET_UPDATED_EVENT, handleTicketUpdated);
      socket.off(CHANNEL_MESSAGE_CREATED_EVENT, handleChannelMessageCreated);
      socket.disconnect();
    };
  }, [customerId]);
}
