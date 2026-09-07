import { describe, expect, it, vi } from "vitest";
import { TicketMentionRealtimeListener } from "./ticket-mention-realtime.listener";
import { TICKET_MENTIONED_EVENT } from "../modules/tickets/tickets.events";
import type { RealtimeGateway } from "./realtime.gateway";

function buildGatewayMock() {
  const emit = vi.fn();
  const to = vi.fn().mockReturnValue({ emit });
  return { server: { to }, _emit: emit, _to: to };
}

function createListener(
  gatewayMock: ReturnType<typeof buildGatewayMock>,
): TicketMentionRealtimeListener {
  return new TicketMentionRealtimeListener(gatewayMock as unknown as RealtimeGateway);
}

const mentionEvent = {
  ticketId: "ticket-1",
  noteId: "note-1",
  recipientUserId: "user-2",
  actorUserId: "user-1",
};

describe("TicketMentionRealtimeListener", () => {
  it("relays ticket.mentioned into agent:{recipientUserId}:notifications with the unmodified event payload", () => {
    const gateway = buildGatewayMock();
    const listener = createListener(gateway);

    listener.onTicketMentioned(mentionEvent);

    expect(gateway._to).toHaveBeenCalledWith("agent:user-2:notifications");
    expect(gateway._emit).toHaveBeenCalledWith(TICKET_MENTIONED_EVENT, mentionEvent);
  });

  it("does not throw when server.to(...).emit(...) throws — catches and logs instead", () => {
    const gateway = buildGatewayMock();
    gateway._to.mockImplementation(() => {
      throw new Error("socket server unavailable");
    });
    const listener = createListener(gateway);

    expect(() => listener.onTicketMentioned(mentionEvent)).not.toThrow();
  });
});
