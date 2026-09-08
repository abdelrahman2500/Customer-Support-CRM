"use client";

import { useEffect, useState } from "react";
import { getAccessToken } from "@/lib/api";
import { acquireSharedSocket, releaseSharedSocket } from "@/lib/realtime-connection";

const AGENT_PRESENCE_CHANGED_EVENT = "agent.presence.changed";

export type PresenceStatus = "online" | "offline";

interface AgentPresenceChangedPayload {
  userId: string;
  status: PresenceStatus;
}

/**
 * Story 108 — Agent Presence UI. Joins `agent:{id}:presence` (Story 71's
 * `RealtimeGateway`/`PresenceService`, unmodified) for every id in
 * `userIds`, on one shared socket — mirrors `useBranchNotifications`'s
 * "one hook, one socket, joined on connect" shape, generalized from one
 * room to a list of rooms. A fresh join always receives the *current*
 * status immediately (the backend's own `sendCurrentPresenceIfApplicable`),
 * not just future transitions, so the returned map is populated right
 * after connecting, not left empty until someone's status happens to
 * change.
 *
 * `userIds` is a plain effect dependency, same as `useBranchNotifications`'s
 * own `branchId` — the caller is responsible for passing a referentially
 * stable array (e.g. `useMemo`'d off query data) so a parent re-render
 * with the same underlying user list doesn't tear down and reopen the
 * socket on every render; see `UserListView`'s own usage.
 *
 * Batch 7 (UX audit) — acquires the shared, pooled socket connection
 * (`realtime-connection.ts`) instead of opening its own. Joins its own
 * list of rooms directly (not `joinRoomOnConnect`, which only ever joins
 * one) — same "join immediately if already connected, and again on every
 * future connect" shape, just looped.
 */
export function useAgentPresence(userIds: string[]): Record<string, PresenceStatus> {
  const [presence, setPresence] = useState<Record<string, PresenceStatus>>({});

  useEffect(() => {
    if (userIds.length === 0 || !getAccessToken()) {
      return;
    }

    const socket = acquireSharedSocket();

    function joinAll() {
      for (const userId of userIds) {
        socket.emit("join", { room: `agent:${userId}:presence` });
      }
    }
    // `connect` fires on every (re)connection, including socket.io's own
    // automatic reconnects — re-joining every room here is what makes
    // reconnects safe without any extra bookkeeping, the same implicit
    // behavior `useTicketRealtime`/`useBranchNotifications` already rely
    // on. Joins immediately too, since the shared socket may already be
    // connected by the time this hook acquires it.
    if (socket.connected) {
      joinAll();
    }
    socket.on("connect", joinAll);

    const handlePresenceChanged = (payload: AgentPresenceChangedPayload) => {
      setPresence((current) => ({ ...current, [payload.userId]: payload.status }));
    };
    socket.on(AGENT_PRESENCE_CHANGED_EVENT, handlePresenceChanged);

    return () => {
      socket.off("connect", joinAll);
      socket.off(AGENT_PRESENCE_CHANGED_EVENT, handlePresenceChanged);
      releaseSharedSocket();
    };
  }, [userIds]);

  return presence;
}
