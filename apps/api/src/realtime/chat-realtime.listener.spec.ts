import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatRealtimeListener } from "./chat-realtime.listener";
import { AI_CHAT_MESSAGE_COMPLETED_EVENT } from "../modules/ai/ai-chat.events";
import type { RealtimeGateway } from "./realtime.gateway";

function buildGatewayMock() {
  const emit = vi.fn();
  const to = vi.fn().mockReturnValue({ emit });
  return { server: { to }, _emit: emit, _to: to };
}

function createListener(gatewayMock: ReturnType<typeof buildGatewayMock>): ChatRealtimeListener {
  return new ChatRealtimeListener(gatewayMock as unknown as RealtimeGateway);
}

describe("ChatRealtimeListener", () => {
  let gateway: ReturnType<typeof buildGatewayMock>;
  let listener: ChatRealtimeListener;

  beforeEach(() => {
    vi.clearAllMocks();
    gateway = buildGatewayMock();
    listener = createListener(gateway);
  });

  it("relays ai.chat_message_completed into chat-session:{id} with the unmodified event payload", () => {
    const event = {
      aiPromptLogId: "log-1",
      chatSessionId: "session-1",
      outcome: "SUCCESS" as const,
    };

    listener.onAiChatMessageCompleted(event);

    expect(gateway._to).toHaveBeenCalledWith("chat-session:session-1");
    expect(gateway._emit).toHaveBeenCalledWith(AI_CHAT_MESSAGE_COMPLETED_EVENT, event);
  });

  it("does not throw when server.to(...).emit(...) throws — catches and logs instead", () => {
    gateway._to.mockImplementation(() => {
      throw new Error("socket server unavailable");
    });
    const event = { aiPromptLogId: "log-1", chatSessionId: "session-1", outcome: "ERROR" as const };

    expect(() => listener.onAiChatMessageCompleted(event)).not.toThrow();
  });
});
