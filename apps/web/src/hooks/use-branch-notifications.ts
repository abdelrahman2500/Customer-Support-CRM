"use client";

import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { getAccessToken, getSocketBaseUrl } from "@/lib/api";
import type { BranchNotificationEventType, BranchNotificationPayload } from "@/lib/notifications-store";

const SLA_AT_RISK_EVENT = "sla.at_risk";
const SLA_BREACHED_EVENT = "sla.breached";
const TICKET_ESCALATED_EVENT = "ticket.escalated";

/**
 * Story 24 — the Agent Workspace's *only* branch-wide realtime subscription:
 * joins the existing `branch:{id}:notifications` room (Story 20's
 * `RealtimeGateway`, Story 22's `BranchNotificationRealtimeListener`, both
 * unmodified) and forwards exactly the three events that room already
 * relays to `onEvent`, verbatim — no envelope, no transformation, no new
 * event names. Mirrors `useTicketRealtime`'s connect/join/cleanup shape,
 * but at Agent Workspace scope: mounted once in `(agent)/layout.tsx`, not
 * per-page, and never joins `ticket:{id}` or any other room.
 *
 * `onEvent` is read through a ref rather than being an effect dependency —
 * intentional: the caller (`BranchNotifications`) passes the Zustand
 * store's `add` action, which is already a stable reference, but this
 * hook must not create a second socket/connection/duplicate listener set
 * merely because a parent re-render produced a new inline callback. Only
 * `branchId` changing re-establishes the connection.
 */
export function useBranchNotifications(
  branchId: string | null,
  onEvent: (eventType: BranchNotificationEventType, payload: BranchNotificationPayload) => void,
): void {
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!branchId) {
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
    // without any extra bookkeeping, the same implicit behavior
    // `useTicketRealtime` already relies on.
    socket.on("connect", () => {
      socket.emit("join", { room: `branch:${branchId}:notifications` });
    });

    const handleSlaAtRisk = (payload: BranchNotificationPayload) =>
      onEventRef.current(SLA_AT_RISK_EVENT, payload);
    const handleSlaBreached = (payload: BranchNotificationPayload) =>
      onEventRef.current(SLA_BREACHED_EVENT, payload);
    const handleTicketEscalated = (payload: BranchNotificationPayload) =>
      onEventRef.current(TICKET_ESCALATED_EVENT, payload);

    socket.on(SLA_AT_RISK_EVENT, handleSlaAtRisk);
    socket.on(SLA_BREACHED_EVENT, handleSlaBreached);
    socket.on(TICKET_ESCALATED_EVENT, handleTicketEscalated);

    return () => {
      socket.off(SLA_AT_RISK_EVENT, handleSlaAtRisk);
      socket.off(SLA_BREACHED_EVENT, handleSlaBreached);
      socket.off(TICKET_ESCALATED_EVENT, handleTicketEscalated);
      socket.disconnect();
    };
  }, [branchId]);
}
