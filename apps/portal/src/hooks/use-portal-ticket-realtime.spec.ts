import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { io } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { usePortalTicketRealtime } from "./use-portal-ticket-realtime";
import { mergeChannelMessage, myTicketMessagesQueryKey } from "./use-portal-tickets";
import { getAccessToken } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  getAccessToken: vi.fn(() => "test-token"),
  getSocketBaseUrl: () => "http://localhost:3001",
}));

vi.mock("socket.io-client", () => ({ io: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: vi.fn() }));
vi.mock("./use-portal-tickets", () => ({
  myTicketMessagesQueryKey: vi.fn((id: string) => ["portal-tickets", id, "messages"]),
  mergeChannelMessage: vi.fn((existing: unknown[] | undefined, incoming: unknown) => [
    ...(existing ?? []),
    incoming,
  ]),
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
  return { setQueryData: vi.fn() };
}

describe("usePortalTicketRealtime", () => {
  let queryClient: ReturnType<typeof buildQueryClientMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = buildQueryClientMock();
    vi.mocked(useQueryClient).mockReturnValue(queryClient as never);
  });

  it("joins ticket:{id} once connected", () => {
    const socket = buildSocketMock();
    vi.mocked(io).mockReturnValue(socket as never);

    renderHook(() => usePortalTicketRealtime("ticket-1"));

    expect(io).toHaveBeenCalledWith("http://localhost:3001", {
      auth: { token: "test-token" },
      transports: ["websocket"],
    });
    socket._trigger("connect");
    expect(socket.emit).toHaveBeenCalledWith("join", { room: "ticket:ticket-1" });
  });

  it("merges an incoming channel.message.created into this ticket's messages cache", () => {
    const socket = buildSocketMock();
    vi.mocked(io).mockReturnValue(socket as never);

    renderHook(() => usePortalTicketRealtime("ticket-1"));
    const message = { id: "message-1", ticketId: "ticket-1", body: "hi" };
    socket._trigger("channel.message.created", { ticketId: "ticket-1", message });

    expect(queryClient.setQueryData).toHaveBeenCalledWith(
      myTicketMessagesQueryKey("ticket-1"),
      expect.any(Function),
    );
    const updater = queryClient.setQueryData.mock.calls[0]?.[1] as (
      current: unknown[] | undefined,
    ) => unknown[];
    expect(updater([])).toEqual([message]);
    expect(mergeChannelMessage).toHaveBeenCalledWith([], message);
  });

  it("ignores a channel.message.created event for a different ticket", () => {
    const socket = buildSocketMock();
    vi.mocked(io).mockReturnValue(socket as never);

    renderHook(() => usePortalTicketRealtime("ticket-1"));
    socket._trigger("channel.message.created", {
      ticketId: "some-other-ticket",
      message: { id: "message-1" },
    });

    expect(queryClient.setQueryData).not.toHaveBeenCalled();
    expect(mergeChannelMessage).not.toHaveBeenCalled();
  });

  it("stops listening and disconnects the socket on unmount", () => {
    const socket = buildSocketMock();
    vi.mocked(io).mockReturnValue(socket as never);

    const { unmount } = renderHook(() => usePortalTicketRealtime("ticket-1"));
    unmount();

    expect(socket.off).toHaveBeenCalledWith("channel.message.created", expect.any(Function));
    expect(socket.disconnect).toHaveBeenCalledOnce();
  });

  it("does not connect when there is no access token", () => {
    vi.mocked(getAccessToken).mockReturnValueOnce(null);

    renderHook(() => usePortalTicketRealtime("ticket-1"));

    expect(io).not.toHaveBeenCalled();
  });
});
