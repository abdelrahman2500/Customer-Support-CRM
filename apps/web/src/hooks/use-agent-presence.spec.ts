import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { io } from "socket.io-client";
import { useAgentPresence } from "./use-agent-presence";
import { getAccessToken } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  getAccessToken: vi.fn(() => "test-token"),
  getSocketBaseUrl: () => "http://localhost:3001",
}));

vi.mock("socket.io-client", () => ({ io: vi.fn() }));

function buildSocketMock() {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  return {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers.set(event, handler);
    }),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    _trigger: (event: string, ...args: unknown[]) => handlers.get(event)?.(...args),
  };
}

describe("useAgentPresence", () => {
  let socket: ReturnType<typeof buildSocketMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    socket = buildSocketMock();
    vi.mocked(io).mockReturnValue(socket as never);
  });

  it("connects using the existing access-token mechanism", () => {
    renderHook(() => useAgentPresence(["user-1"]));

    expect(io).toHaveBeenCalledWith("http://localhost:3001", {
      auth: { token: "test-token" },
      transports: ["websocket"],
    });
  });

  it("joins agent:{id}:presence for every given user id once connected", () => {
    renderHook(() => useAgentPresence(["user-1", "user-2"]));

    socket._trigger("connect");

    expect(socket.emit).toHaveBeenCalledWith("join", { room: "agent:user-1:presence" });
    expect(socket.emit).toHaveBeenCalledWith("join", { room: "agent:user-2:presence" });
  });

  it("records a status the moment agent.presence.changed arrives (e.g. the backend's own fresh-join reply)", () => {
    const { result } = renderHook(() => useAgentPresence(["user-1"]));

    act(() => {
      socket._trigger("agent.presence.changed", { userId: "user-1", status: "online" });
    });

    expect(result.current).toEqual({ "user-1": "online" });
  });

  it("tracks multiple users independently", () => {
    const { result } = renderHook(() => useAgentPresence(["user-1", "user-2"]));

    act(() => {
      socket._trigger("agent.presence.changed", { userId: "user-1", status: "online" });
      socket._trigger("agent.presence.changed", { userId: "user-2", status: "offline" });
    });

    expect(result.current).toEqual({ "user-1": "online", "user-2": "offline" });
  });

  it("updates an existing user's status on a later transition", () => {
    const { result } = renderHook(() => useAgentPresence(["user-1"]));

    act(() => {
      socket._trigger("agent.presence.changed", { userId: "user-1", status: "online" });
    });
    act(() => {
      socket._trigger("agent.presence.changed", { userId: "user-1", status: "offline" });
    });

    expect(result.current).toEqual({ "user-1": "offline" });
  });

  it("does not connect when userIds is empty", () => {
    renderHook(() => useAgentPresence([]));

    expect(io).not.toHaveBeenCalled();
  });

  it("does not connect when there is no access token", () => {
    vi.mocked(getAccessToken).mockReturnValueOnce(null);

    renderHook(() => useAgentPresence(["user-1"]));

    expect(io).not.toHaveBeenCalled();
  });

  it("disconnects and removes listeners on unmount", () => {
    const { unmount } = renderHook(() => useAgentPresence(["user-1"]));

    unmount();

    expect(socket.off).toHaveBeenCalledWith("agent.presence.changed", expect.any(Function));
    expect(socket.disconnect).toHaveBeenCalledOnce();
  });

  it("re-establishes the connection when userIds changes", () => {
    const { rerender } = renderHook(({ ids }: { ids: string[] }) => useAgentPresence(ids), {
      initialProps: { ids: ["user-1"] },
    });
    expect(io).toHaveBeenCalledTimes(1);

    rerender({ ids: ["user-1", "user-2"] });

    expect(socket.disconnect).toHaveBeenCalledOnce();
    expect(io).toHaveBeenCalledTimes(2);
  });
});
