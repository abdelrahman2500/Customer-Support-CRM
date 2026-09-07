import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { io } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { useMentionNotifications } from "./use-mention-notifications";

vi.mock("@/lib/api", () => ({
  getAccessToken: vi.fn(() => "test-token"),
  getSocketBaseUrl: () => "http://localhost:3001",
}));

vi.mock("socket.io-client", () => ({ io: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: vi.fn() }));
vi.mock("./use-notifications", () => ({
  unreadNotificationCountQueryKey: ["notifications", "unread-count"],
}));

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

function buildQueryClientMock() {
  return { invalidateQueries: vi.fn() };
}

describe("useMentionNotifications", () => {
  let queryClient: ReturnType<typeof buildQueryClientMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = buildQueryClientMock();
    vi.mocked(useQueryClient).mockReturnValue(queryClient as never);
  });

  it("does not connect when there is no userId", () => {
    renderHook(() => useMentionNotifications(null));

    expect(io).not.toHaveBeenCalled();
  });

  it("joins agent:{userId}:notifications once connected", () => {
    const socket = buildSocketMock();
    vi.mocked(io).mockReturnValue(socket as never);

    renderHook(() => useMentionNotifications("user-1"));

    expect(io).toHaveBeenCalledWith("http://localhost:3001", {
      auth: { token: "test-token" },
      transports: ["websocket"],
    });
    socket._trigger("connect");
    expect(socket.emit).toHaveBeenCalledWith("join", { room: "agent:user-1:notifications" });
  });

  it("invalidates both the notifications list and the unread-count query when ticket.mentioned is received", () => {
    const socket = buildSocketMock();
    vi.mocked(io).mockReturnValue(socket as never);

    renderHook(() => useMentionNotifications("user-1"));
    socket._trigger("ticket.mentioned", {
      ticketId: "ticket-1",
      noteId: "note-1",
      recipientUserId: "user-1",
      actorUserId: "user-2",
    });

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["notifications"] });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["notifications", "unread-count"],
    });
  });

  it("disconnects on unmount", () => {
    const socket = buildSocketMock();
    vi.mocked(io).mockReturnValue(socket as never);

    const { unmount } = renderHook(() => useMentionNotifications("user-1"));
    unmount();

    expect(socket.disconnect).toHaveBeenCalledOnce();
  });

  it("reconnects when userId changes", () => {
    const socket = buildSocketMock();
    vi.mocked(io).mockReturnValue(socket as never);

    const { rerender } = renderHook(({ userId }) => useMentionNotifications(userId), {
      initialProps: { userId: "user-1" },
    });
    rerender({ userId: "user-2" });

    expect(socket.disconnect).toHaveBeenCalledOnce();
    expect(io).toHaveBeenCalledTimes(2);
  });
});
