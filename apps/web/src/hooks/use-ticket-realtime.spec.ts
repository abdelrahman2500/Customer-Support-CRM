import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { io } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { useTicketRealtime } from "./use-ticket-realtime";
import { invalidateTicketQueries } from "./use-tickets";
import { mergeChannelMessage, ticketMessagesQueryKey } from "./use-ticket-messages";
import { ticketAiResultQueryKey } from "./use-ticket-ai";
import { getAccessToken } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  getAccessToken: vi.fn(() => "test-token"),
  getSocketBaseUrl: () => "http://localhost:3001",
}));

vi.mock("socket.io-client", () => ({ io: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: vi.fn() }));
vi.mock("./use-tickets", () => ({ invalidateTicketQueries: vi.fn() }));
vi.mock("./use-ticket-messages", () => ({
  ticketMessagesQueryKey: vi.fn((id: string) => ["ticket", id, "messages"]),
  mergeChannelMessage: vi.fn((existing: unknown[] | undefined, incoming: unknown) => [
    ...(existing ?? []),
    incoming,
  ]),
}));
vi.mock("./use-ticket-ai", () => ({
  ticketAiResultQueryKey: vi.fn((ticketId: string, logId: string) => [
    "ticket",
    ticketId,
    "ai",
    logId,
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
  return { setQueryData: vi.fn(), invalidateQueries: vi.fn() };
}

describe("useTicketRealtime", () => {
  let queryClient: ReturnType<typeof buildQueryClientMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = buildQueryClientMock();
    vi.mocked(useQueryClient).mockReturnValue(queryClient as never);
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

    expect(invalidateTicketQueries).toHaveBeenCalledWith(queryClient, "ticket-1");
  });

  it("invalidates this ticket's queries when ticket.escalated is received", () => {
    const socket = buildSocketMock();
    vi.mocked(io).mockReturnValue(socket as never);

    renderHook(() => useTicketRealtime("ticket-1"));
    socket._trigger("ticket.escalated", { ticket: { id: "ticket-1" } });

    expect(invalidateTicketQueries).toHaveBeenCalledWith(queryClient, "ticket-1");
  });

  it("merges an incoming channel.message.created into this ticket's messages cache", () => {
    const socket = buildSocketMock();
    vi.mocked(io).mockReturnValue(socket as never);

    renderHook(() => useTicketRealtime("ticket-1"));
    const message = { id: "message-1", ticketId: "ticket-1", body: "hi" };
    socket._trigger("channel.message.created", { ticketId: "ticket-1", message });

    expect(queryClient.setQueryData).toHaveBeenCalledWith(
      ticketMessagesQueryKey("ticket-1"),
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

    renderHook(() => useTicketRealtime("ticket-1"));
    socket._trigger("channel.message.created", {
      ticketId: "some-other-ticket",
      message: { id: "message-1" },
    });

    expect(queryClient.setQueryData).not.toHaveBeenCalled();
    expect(mergeChannelMessage).not.toHaveBeenCalled();
  });

  it("stops listening for channel.message.created on unmount", () => {
    const socket = buildSocketMock();
    vi.mocked(io).mockReturnValue(socket as never);

    const { unmount } = renderHook(() => useTicketRealtime("ticket-1"));
    unmount();

    expect(socket.off).toHaveBeenCalledWith("channel.message.created", expect.any(Function));
  });

  it("disconnects the socket on unmount", () => {
    const socket = buildSocketMock();
    vi.mocked(io).mockReturnValue(socket as never);

    const { unmount } = renderHook(() => useTicketRealtime("ticket-1"));
    unmount();

    expect(socket.disconnect).toHaveBeenCalledOnce();
  });

  it("invalidates the exact AI result query key when ai.prompt_completed is received", () => {
    const socket = buildSocketMock();
    vi.mocked(io).mockReturnValue(socket as never);

    renderHook(() => useTicketRealtime("ticket-1"));
    socket._trigger("ai.prompt_completed", {
      aiPromptLogId: "log-1",
      ticketId: "ticket-1",
      feature: "SUMMARIZE",
      outcome: "SUCCESS",
    });

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ticketAiResultQueryKey("ticket-1", "log-1"),
    });
  });

  it("ignores an ai.prompt_completed event for a different ticket", () => {
    const socket = buildSocketMock();
    vi.mocked(io).mockReturnValue(socket as never);

    renderHook(() => useTicketRealtime("ticket-1"));
    socket._trigger("ai.prompt_completed", {
      aiPromptLogId: "log-1",
      ticketId: "some-other-ticket",
      feature: "SUMMARIZE",
      outcome: "SUCCESS",
    });

    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  });

  it("does not connect when there is no access token", () => {
    vi.mocked(getAccessToken).mockReturnValueOnce(null);

    renderHook(() => useTicketRealtime("ticket-1"));

    expect(io).not.toHaveBeenCalled();
  });
});
