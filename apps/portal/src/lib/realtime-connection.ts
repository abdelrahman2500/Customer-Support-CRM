"use client";

import { useSyncExternalStore } from "react";
import { io, type Socket } from "socket.io-client";
import { getAccessToken, getSocketBaseUrl } from "./api";

/**
 * Batch 7 (UX audit) — mirrors `apps/web/src/lib/realtime-connection.ts`
 * file-for-file (same "no shared package between apps" convention this
 * codebase already uses elsewhere — see e.g. `notifications-api.ts`'s own
 * re-declaration precedent). The one Socket.IO connection every realtime
 * hook in this app shares, replacing 3 independent, unpooled `io()`
 * connections that could all be open simultaneously on one page (a
 * customer's Ticket Detail page mounts `usePortalTicketRealtime` +
 * `usePortalNotifications` at once).
 *
 * See the web app's own copy of this file for the full rationale
 * (reference-counted pooling, the "already connected" join problem
 * `joinRoomOnConnect` solves, and reconnect detection) — identical here.
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
 * case a banner should show. See the web app's own copy of this file for
 * the full reasoning.
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
