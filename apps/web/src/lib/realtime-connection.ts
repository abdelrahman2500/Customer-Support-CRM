"use client";

import { useSyncExternalStore } from "react";
import { io, type Socket } from "socket.io-client";
import { getAccessToken, getSocketBaseUrl } from "./api";

/**
 * Batch 7 (UX audit) — the one Socket.IO connection every realtime hook in
 * this app shares, replacing 5 independent, unpooled `io()` connections
 * that could all be open simultaneously on one page (e.g. Ticket Detail:
 * `useTicketRealtime` + `useBranchNotifications` + `useAgentPresence` +
 * `useMentionNotifications`, mounted at once).
 *
 * ## Reference-counted, not "connect once for the app's lifetime"
 *
 * Every existing hook connects on mount and disconnects on unmount — that
 * behavior is preserved exactly, just pooled: `acquireSharedSocket()`
 * increments a ref count and creates the socket only if this is the first
 * acquirer; `releaseSharedSocket()` decrements it and only actually
 * disconnects once the count reaches zero. A hook that mounts while the
 * socket is already open (the common case once more than one realtime hook
 * is mounted) gets the same, already-connected socket instead of opening a
 * second connection.
 *
 * ## The "already connected" join problem this module's `joinRoomOnConnect`
 * exists to solve
 *
 * Every hook's own room-join fires from a `connect` listener, since
 * `connect` reliably fires again on every automatic reconnect (the
 * existing, load-bearing behavior this refactor must not lose). But with a
 * *shared* socket, a hook that acquires it *after* it's already connected
 * would never see that first `connect` event fire again — it already fired
 * for whichever hook acquired the socket first. `joinRoomOnConnect` joins
 * immediately when the socket is already connected, in addition to
 * attaching the listener for every future (re)connect.
 *
 * ## Connection status + reconnect detection
 *
 * `useSocketConnectionStatus()` exposes `"connecting" | "connected" |
 * "disconnected"` for a small UI affordance (Batch 7's other goal: no
 * hook anywhere previously surfaced a disconnect to the user at all).
 * `onReconnect()` fires only on a *second or later* `connect` — the first
 * one is a normal startup, not a recovery — so a consumer can run a
 * targeted refetch to backfill whatever happened during the outage,
 * instead of the previous silent behavior (a room rejoin with no
 * awareness that anything had been missed).
 */

type ConnectionStatus = "connecting" | "connected" | "disconnected";

let socket: Socket | null = null;
let refCount = 0;
let status: ConnectionStatus = "disconnected";
let hasConnectedBefore = false;

const statusListeners = new Set<() => void>();
const reconnectListeners = new Set<() => void>();

function notifyStatusListeners() {
  statusListeners.forEach((listener) => listener());
}

function setStatus(next: ConnectionStatus) {
  if (status === next) {
    return;
  }
  status = next;
  notifyStatusListeners();
}

/** Acquires the shared socket, connecting it if this is the first
 * acquirer. Pair with exactly one `releaseSharedSocket()` call (typically
 * in the same effect's cleanup) — mismatched acquire/release calls leak
 * the connection or drop it out from under a still-mounted hook. */
export function acquireSharedSocket(): Socket {
  refCount += 1;
  if (!socket) {
    const token = getAccessToken();
    setStatus("connecting");
    socket = io(getSocketBaseUrl(), {
      auth: { token },
      transports: ["websocket"],
    });
    socket.on("connect", () => {
      setStatus("connected");
      if (hasConnectedBefore) {
        reconnectListeners.forEach((listener) => listener());
      }
      hasConnectedBefore = true;
    });
    socket.on("disconnect", () => setStatus("disconnected"));
    socket.on("connect_error", () => setStatus("disconnected"));
  }
  return socket;
}

/** Releases one acquisition; disconnects and clears the shared socket once
 * nothing holds it anymore. */
export function releaseSharedSocket(): void {
  refCount = Math.max(0, refCount - 1);
  if (refCount === 0 && socket) {
    socket.disconnect();
    socket = null;
    // Reassigned directly (not via `setStatus`, whose value-equality guard
    // would otherwise skip notifying listeners when `status` was already
    // "disconnected" — e.g. releasing mid-outage) since `hasConnectedBefore`
    // resetting to `false` changes `useRealtimeConnectionIssue`'s derived
    // snapshot even when the raw `status` string doesn't change.
    hasConnectedBefore = false;
    status = "disconnected";
    notifyStatusListeners();
  }
}

/** Joins `room` immediately if `socket` is already connected, and again on
 * every future (re)connect. Returns an unsubscribe function — call it from
 * the caller's own effect cleanup, alongside `releaseSharedSocket()`. */
export function joinRoomOnConnect(socket: Socket, room: string): () => void {
  function join() {
    socket.emit("join", { room });
  }
  if (socket.connected) {
    join();
  }
  socket.on("connect", join);
  return () => socket.off("connect", join);
}

/** Fires on every reconnect (a `connect` event *after* the first one) —
 * never on the initial, first-ever connect. */
export function onReconnect(listener: () => void): () => void {
  reconnectListeners.add(listener);
  return () => reconnectListeners.delete(listener);
}

function subscribeStatus(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

function getStatus(): ConnectionStatus {
  return status;
}

function getServerStatus(): ConnectionStatus {
  // SSR/first-paint snapshot — no socket exists on the server.
  return "disconnected";
}

/** The shared connection's current status, reactive across every
 * component that calls this — there is exactly one status, since there is
 * exactly one socket. */
export function useSocketConnectionStatus(): ConnectionStatus {
  return useSyncExternalStore(subscribeStatus, getStatus, getServerStatus);
}

/**
 * `true` only while there is active demand for the connection (at least
 * one hook currently holds it) and it is down after having connected at
 * least once — the actual "you're offline, we're trying to reconnect"
 * case a banner should show.
 *
 * Deliberately narrower than `status === "disconnected"`: that also covers
 * two cases that are not a problem worth surfacing — nothing on the
 * current page uses realtime at all (every hook has released, which also
 * resets `hasConnectedBefore`), and the very first connection attempt
 * still in flight (`status` is `"connecting"`, not `"disconnected"`, during
 * that window). Both would otherwise flash this banner on an ordinary page
 * load.
 */
function getConnectionIssue(): boolean {
  return status === "disconnected" && hasConnectedBefore;
}

export function useRealtimeConnectionIssue(): boolean {
  return useSyncExternalStore(subscribeStatus, getConnectionIssue, () => false);
}

/** Test-only: resets every module-level variable between tests. Real
 * callers never import this — see each realtime hook's own spec file for
 * the `beforeEach` that calls it. */
export function __resetSharedSocketForTests(): void {
  socket?.disconnect();
  socket = null;
  refCount = 0;
  hasConnectedBefore = false;
  status = "disconnected";
  statusListeners.clear();
  reconnectListeners.clear();
}
