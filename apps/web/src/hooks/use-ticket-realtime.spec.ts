import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { io } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { useTicketRealtime } from "./use-ticket-realtime";
import { invalidateTicketQueries } from "./use-tickets";
import { getAccessToken } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  getAccessToken: vi.fn(() => "test-token"),
  getSocketBaseUrl: () => "http://localhost:3001",
}));

vi.mock("socket.io-client", () => ({ io: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: vi.fn() }));
vi.mock("./use-tickets", () => ({ invalidateTicketQueries: vi.fn() }));

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

describe("useTicketRealtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useQueryClient).mockReturnValue("query-client" as never);
  });

  it("joins ticket:{id} once connected", () => {
    const socket = buildSocketMock();
    vi.mocked(io).mockReturnValue(socket as never);

    renderHook(() => useTicketRealtime("ticket-1"));

    expect(io).toHaveBeenCalledWith("http://localhost:3001", {
      auth: { token: "test-token" },
      transports: ["websocket"],
    });
    socket._trigger("connect");
    expect(socket.emit).toHaveBeenCalledWith("join", { room: "ticket:ticket-1" });
  });

  it("invalidates this ticket's queries when ticket.updated is received", () => {
    const socket = buildSocketMock();
    vi.mocked(io).mockReturnValue(socket as never);

    renderHook(() => useTicketRealtime("ticket-1"));
    socket._trigger("ticket.updated", { ticket: { id: "ticket-1" } });

    expect(invalidateTicketQueries).toHaveBeenCalledWith("query-client", "ticket-1");
  });

  it("invalidates this ticket's queries when ticket.escalated is received", () => {
    const socket = buildSocketMock();
    vi.mocked(io).mockReturnValue(socket as never);

    renderHook(() => useTicketRealtime("ticket-1"));
    socket._trigger("ticket.escalated", { ticket: { id: "ticket-1" } });

    expect(invalidateTicketQueries).toHaveBeenCalledWith("query-client", "ticket-1");
  });

  it("disconnects the socket on unmount", () => {
    const socket = buildSocketMock();
    vi.mocked(io).mockReturnValue(socket as never);

    const { unmount } = renderHook(() => useTicketRealtime("ticket-1"));
    unmount();

    expect(socket.disconnect).toHaveBeenCalledOnce();
  });

  it("does not connect when there is no access token", () => {
    vi.mocked(getAccessToken).mockReturnValueOnce(null);

    renderHook(() => useTicketRealtime("ticket-1"));

    expect(io).not.toHaveBeenCalled();
  });
});
