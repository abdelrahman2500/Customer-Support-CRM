import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { io } from "socket.io-client";
import {
  acquireSharedSocket,
  joinRoomOnConnect,
  onReconnect,
  releaseSharedSocket,
  useRealtimeConnectionIssue,
  useSocketConnectionStatus,
  __resetSharedSocketForTests,
} from "./realtime-connection";

vi.mock("./api", () => ({
  getAccessToken: vi.fn(() => "test-token"),
  getSocketBaseUrl: () => "http://localhost:3001",
}));

vi.mock("socket.io-client", () => ({ io: vi.fn() }));

function buildSocketMock() {
  const handlers = new Map<string, Set<(...args: unknown[]) => void>>();
  return {
    connected: false,
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      const set = handlers.get(event) ?? new Set();
      set.add(handler);
      handlers.set(event, set);
    }),
    off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers.get(event)?.delete(handler);
    }),
    emit: vi.fn(),
    disconnect: vi.fn(),
    _trigger(event: string, ...args: unknown[]) {
      for (const handler of handlers.get(event) ?? []) {
        handler(...args);
      }
    },
  };
}

describe("realtime-connection", () => {
  let socket: ReturnType<typeof buildSocketMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    __resetSharedSocketForTests();
    socket = buildSocketMock();
    vi.mocked(io).mockReturnValue(socket as never);
  });

  describe("acquireSharedSocket / releaseSharedSocket", () => {
    it("opens exactly one connection for two concurrent acquirers", () => {
      acquireSharedSocket();
      acquireSharedSocket();

      expect(io).toHaveBeenCalledOnce();
    });

    it("authenticates using the existing access-token mechanism", () => {
      acquireSharedSocket();

      expect(io).toHaveBeenCalledWith("http://localhost:3001", {
        auth: { token: "test-token" },
        transports: ["websocket"],
      });
    });

    it("does not disconnect while at least one acquirer still holds it", () => {
      acquireSharedSocket();
      acquireSharedSocket();

      releaseSharedSocket();

      expect(socket.disconnect).not.toHaveBeenCalled();
    });

    it("disconnects once the last acquirer releases it", () => {
      acquireSharedSocket();
      acquireSharedSocket();

      releaseSharedSocket();
      releaseSharedSocket();

      expect(socket.disconnect).toHaveBeenCalledOnce();
    });

    it("opens a fresh connection for a new acquirer after the previous one fully released", () => {
      acquireSharedSocket();
      releaseSharedSocket();

      acquireSharedSocket();

      expect(io).toHaveBeenCalledTimes(2);
    });
  });

  describe("joinRoomOnConnect", () => {
    it("joins immediately when the socket is already connected", () => {
      const realSocket = acquireSharedSocket();
      socket.connected = true;

      joinRoomOnConnect(realSocket, "ticket:ticket-1");

      expect(socket.emit).toHaveBeenCalledWith("join", { room: "ticket:ticket-1" });
    });

    it("does not join immediately when not yet connected, but does on connect", () => {
      const realSocket = acquireSharedSocket();
      socket.connected = false;

      joinRoomOnConnect(realSocket, "ticket:ticket-1");
      expect(socket.emit).not.toHaveBeenCalled();

      act(() => socket._trigger("connect"));
      expect(socket.emit).toHaveBeenCalledWith("join", { room: "ticket:ticket-1" });
    });

    it("rejoins on every subsequent connect (automatic reconnects included)", () => {
      const realSocket = acquireSharedSocket();
      socket.connected = false;
      joinRoomOnConnect(realSocket, "ticket:ticket-1");

      act(() => socket._trigger("connect"));
      act(() => socket._trigger("connect"));

      expect(socket.emit).toHaveBeenCalledTimes(2);
    });

    it("stops rejoining once unsubscribed", () => {
      const realSocket = acquireSharedSocket();
      const unsubscribe = joinRoomOnConnect(realSocket, "ticket:ticket-1");

      unsubscribe();
      act(() => socket._trigger("connect"));

      expect(socket.emit).not.toHaveBeenCalled();
    });
  });

  describe("onReconnect", () => {
    it("does not fire on the first-ever connect", () => {
      acquireSharedSocket();
      const listener = vi.fn();
      onReconnect(listener);

      act(() => socket._trigger("connect"));

      expect(listener).not.toHaveBeenCalled();
    });

    it("fires on every connect after the first", () => {
      acquireSharedSocket();
      const listener = vi.fn();
      onReconnect(listener);

      act(() => socket._trigger("connect"));
      act(() => socket._trigger("connect"));
      act(() => socket._trigger("connect"));

      expect(listener).toHaveBeenCalledTimes(2);
    });
  });

  describe("useSocketConnectionStatus", () => {
    it("starts disconnected before anything acquires the socket", () => {
      const { result } = renderHook(() => useSocketConnectionStatus());

      expect(result.current).toBe("disconnected");
    });

    it("reports connecting immediately after the first acquire", () => {
      const { result } = renderHook(() => useSocketConnectionStatus());

      act(() => {
        acquireSharedSocket();
      });

      expect(result.current).toBe("connecting");
    });

    it("reports connected once the socket connects", () => {
      const { result } = renderHook(() => useSocketConnectionStatus());
      acquireSharedSocket();

      act(() => socket._trigger("connect"));

      expect(result.current).toBe("connected");
    });

    it("reports disconnected after a disconnect event", () => {
      const { result } = renderHook(() => useSocketConnectionStatus());
      acquireSharedSocket();
      act(() => socket._trigger("connect"));

      act(() => socket._trigger("disconnect"));

      expect(result.current).toBe("disconnected");
    });

    it("is shared across every consumer, not one status per hook instance", () => {
      const a = renderHook(() => useSocketConnectionStatus());
      const b = renderHook(() => useSocketConnectionStatus());
      acquireSharedSocket();

      act(() => socket._trigger("connect"));

      expect(a.result.current).toBe("connected");
      expect(b.result.current).toBe("connected");
    });
  });

  describe("useRealtimeConnectionIssue", () => {
    it("is false before anything has ever connected", () => {
      const { result } = renderHook(() => useRealtimeConnectionIssue());

      expect(result.current).toBe(false);
    });

    it("is false during the very first connection attempt (not yet a 'reconnect')", () => {
      const { result } = renderHook(() => useRealtimeConnectionIssue());

      act(() => {
        acquireSharedSocket();
      });

      expect(result.current).toBe(false);
    });

    it("is false once connected", () => {
      const { result } = renderHook(() => useRealtimeConnectionIssue());
      acquireSharedSocket();

      act(() => socket._trigger("connect"));

      expect(result.current).toBe(false);
    });

    it("is true once a previously-connected socket drops", () => {
      const { result } = renderHook(() => useRealtimeConnectionIssue());
      acquireSharedSocket();
      act(() => socket._trigger("connect"));

      act(() => socket._trigger("disconnect"));

      expect(result.current).toBe(true);
    });

    it("clears once the connection recovers", () => {
      const { result } = renderHook(() => useRealtimeConnectionIssue());
      acquireSharedSocket();
      act(() => socket._trigger("connect"));
      act(() => socket._trigger("disconnect"));

      act(() => socket._trigger("connect"));

      expect(result.current).toBe(false);
    });

    it("is false once nothing needs the connection anymore, even mid-outage", () => {
      const { result } = renderHook(() => useRealtimeConnectionIssue());
      acquireSharedSocket();
      act(() => socket._trigger("connect"));
      act(() => socket._trigger("disconnect"));

      act(() => releaseSharedSocket());

      // Releasing the last acquirer while disconnected is a deliberate
      // teardown (e.g. navigating off the last page that needed realtime),
      // not an outage worth a banner for.
      expect(result.current).toBe(false);
    });
  });
});
