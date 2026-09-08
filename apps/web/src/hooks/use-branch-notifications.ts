"use client";

import { useEffect, useRef } from "react";
import { getAccessToken } from "@/lib/api";
import {
  acquireSharedSocket,
  joinRoomOnConnect,
  releaseSharedSocket,
} from "@/lib/realtime-connection";
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
 * hook must not tear down its room-join/listeners merely because a parent
 * re-render produced a new inline callback. Only `branchId` changing
 * re-establishes the room join.
 *
 * Batch 7 (UX audit) — acquires the shared, pooled socket connection
 * (`realtime-connection.ts`) instead of opening its own: this hook is
 * commonly mounted alongside `useAgentPresence`/`useMentionNotifications`/
 * `useTaskReminders`, which previously meant up to 4 simultaneous,
 * independent connections for one signed-in agent.
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
    if (!branchId || !getAccessToken()) {
      return;
    }

    const socket = acquireSharedSocket();
    const unjoin = joinRoomOnConnect(socket, `branch:${branchId}:notifications`);

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
      unjoin();
      socket.off(SLA_AT_RISK_EVENT, handleSlaAtRisk);
      socket.off(SLA_BREACHED_EVENT, handleSlaBreached);
      socket.off(TICKET_ESCALATED_EVENT, handleTicketEscalated);
      releaseSharedSocket();
    };
  }, [branchId]);
}
