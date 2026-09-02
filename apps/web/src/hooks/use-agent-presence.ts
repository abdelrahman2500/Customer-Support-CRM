"use client";

import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { getAccessToken, getSocketBaseUrl } from "@/lib/api";

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
 */
export function useAgentPresence(userIds: string[]): Record<string, PresenceStatus> {
  const [presence, setPresence] = useState<Record<string, PresenceStatus>>({});

  useEffect(() => {
    if (userIds.length === 0) {
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
    // automatic reconnects — re-joining every room here is what makes
    // reconnects safe without any extra bookkeeping, the same implicit
    // behavior `useTicketRealtime`/`useBranchNotifications` already rely
    // on.
    socket.on("connect", () => {
      for (const userId of userIds) {
        socket.emit("join", { room: `agent:${userId}:presence` });
      }
    });

    const handlePresenceChanged = (payload: AgentPresenceChangedPayload) => {
      setPresence((current) => ({ ...current, [payload.userId]: payload.status }));
    };
    socket.on(AGENT_PRESENCE_CHANGED_EVENT, handlePresenceChanged);

    return () => {
      socket.off(AGENT_PRESENCE_CHANGED_EVENT, handlePresenceChanged);
      socket.disconnect();
    };
  }, [userIds]);

  return presence;
}
