import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { io } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { useChatRealtime } from "./use-chat-realtime";
import { chatAiResultQueryKey, chatMessagesQueryKey } from "./use-chat";
import { getAccessToken } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  getAccessToken: vi.fn(() => "test-token"),
  getSocketBaseUrl: () => "http://localhost:3001",
}));

vi.mock("socket.io-client", () => ({ io: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: vi.fn() }));

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

describe("useChatRealtime", () => {
  let queryClient: ReturnType<typeof buildQueryClientMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = buildQueryClientMock();
    vi.mocked(useQueryClient).mockReturnValue(queryClient as never);
  });

  it("joins chat-session:{id} once connected", () => {
    const socket = buildSocketMock();
    vi.mocked(io).mockReturnValue(socket as never);

    renderHook(() => useChatRealtime("session-1"));

    expect(io).toHaveBeenCalledWith("http://localhost:3001", {
      auth: { token: "test-token" },
      transports: ["websocket"],
    });
    socket._trigger("connect");
    expect(socket.emit).toHaveBeenCalledWith("join", { room: "chat-session:session-1" });
  });

  it("invalidates the exact AI result key and the messages list when ai.chat_message_completed is received", () => {
    const socket = buildSocketMock();
    vi.mocked(io).mockReturnValue(socket as never);

    renderHook(() => useChatRealtime("session-1"));
    socket._trigger("ai.chat_message_completed", {
      aiPromptLogId: "log-1",
      chatSessionId: "session-1",
      outcome: "SUCCESS",
    });

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: chatAiResultQueryKey("session-1", "log-1"),
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: chatMessagesQueryKey("session-1"),
    });
  });

  it("ignores an ai.chat_message_completed event for a different session", () => {
    const socket = buildSocketMock();
    vi.mocked(io).mockReturnValue(socket as never);

    renderHook(() => useChatRealtime("session-1"));
    socket._trigger("ai.chat_message_completed", {
      aiPromptLogId: "log-1",
      chatSessionId: "some-other-session",
      outcome: "SUCCESS",
    });

    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  });

  it("does not connect when sessionId is null", () => {
    renderHook(() => useChatRealtime(null));

    expect(io).not.toHaveBeenCalled();
  });

  it("does not connect when there is no access token", () => {
    vi.mocked(getAccessToken).mockReturnValueOnce(null);

    renderHook(() => useChatRealtime("session-1"));

    expect(io).not.toHaveBeenCalled();
  });

  it("stops listening and disconnects the socket on unmount", () => {
    const socket = buildSocketMock();
    vi.mocked(io).mockReturnValue(socket as never);

    const { unmount } = renderHook(() => useChatRealtime("session-1"));
    unmount();

    expect(socket.off).toHaveBeenCalledWith("ai.chat_message_completed", expect.any(Function));
    expect(socket.disconnect).toHaveBeenCalledOnce();
  });
});
