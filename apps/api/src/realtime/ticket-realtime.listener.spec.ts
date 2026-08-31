import { beforeEach, describe, expect, it, vi } from "vitest";
import { TicketRealtimeListener } from "./ticket-realtime.listener";
import {
  TICKET_UPDATED_EVENT,
  TICKET_ESCALATED_EVENT,
  TICKET_NOTE_ADDED_EVENT,
} from "../modules/tickets/tickets.events";
import { AI_PROMPT_COMPLETED_EVENT } from "../modules/ai/ai.events";
import { CHANNEL_MESSAGE_CREATED_EVENT } from "../modules/channels/channel-messages.events";
import type { RealtimeGateway } from "./realtime.gateway";

function buildGatewayMock() {
  const emit = vi.fn();
  const to = vi.fn().mockReturnValue({ emit });
  const emitToAgentsInRoom = vi.fn().mockResolvedValue(undefined);
  return { server: { to }, emitToAgentsInRoom, _emit: emit, _to: to };
}

function createListener(gatewayMock: ReturnType<typeof buildGatewayMock>): TicketRealtimeListener {
  return new TicketRealtimeListener(gatewayMock as unknown as RealtimeGateway);
}

const ticketSummary = {
  id: "ticket-1",
  subject: "Cannot log in",
  category: "billing",
  priority: "MEDIUM" as const,
  status: "OPEN" as const,
  customerId: "customer-1",
  contactId: null,
  departmentId: null,
  assignedToUserId: null,
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  updatedAt: new Date("2024-01-01T00:00:00.000Z"),
};

describe("TicketRealtimeListener", () => {
  let gateway: ReturnType<typeof buildGatewayMock>;
  let listener: TicketRealtimeListener;

  beforeEach(() => {
    vi.clearAllMocks();
    gateway = buildGatewayMock();
    listener = createListener(gateway);
  });

  it("relays ticket.updated into ticket:{id} with the unmodified event payload (plain broadcast — already customer-visible via REST)", () => {
    const event = { ticket: ticketSummary, actorUserId: "user-1" };

    listener.onTicketUpdated(event);

    expect(gateway._to).toHaveBeenCalledWith("ticket:ticket-1");
    expect(gateway._emit).toHaveBeenCalledWith(TICKET_UPDATED_EVENT, event);
    expect(gateway.emitToAgentsInRoom).not.toHaveBeenCalled();
  });

  // Story 77 — internal-only content: routed through emitToAgentsInRoom,
  // never the plain whole-room broadcast, so a customer sharing ticket:{id}
  // never receives it.
  it("relays ticket.escalated to agents only in ticket:{id}", () => {
    const event = { ticket: ticketSummary, actorUserId: null };

    listener.onTicketEscalated(event);

    expect(gateway.emitToAgentsInRoom).toHaveBeenCalledWith(
      "ticket:ticket-1",
      TICKET_ESCALATED_EVENT,
      event,
    );
    expect(gateway._to).not.toHaveBeenCalled();
  });

  it("relays ticket.note-added to agents only in ticket:{id} (Story 50/77 — internal notes never reach a customer)", () => {
    const event = {
      ticketId: "ticket-1",
      note: {
        id: "note-1",
        ticketId: "ticket-1",
        authorUserId: "user-1",
        body: "Called the customer back.",
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
      },
    };

    listener.onTicketNoteAdded(event);

    expect(gateway.emitToAgentsInRoom).toHaveBeenCalledWith(
      "ticket:ticket-1",
      TICKET_NOTE_ADDED_EVENT,
      event,
    );
    expect(gateway._to).not.toHaveBeenCalled();
  });

  it("relays ai.prompt_completed to agents only in ticket:{id} (Story 76/77 — internal AI-tooling state)", () => {
    const event = {
      aiPromptLogId: "log-1",
      ticketId: "ticket-1",
      feature: "SUMMARIZE" as const,
      outcome: "SUCCESS" as const,
    };

    listener.onAiPromptCompleted(event);

    expect(gateway.emitToAgentsInRoom).toHaveBeenCalledWith(
      "ticket:ticket-1",
      AI_PROMPT_COMPLETED_EVENT,
      event,
    );
    expect(gateway._to).not.toHaveBeenCalled();
  });

  // Story 77 — the one event meant for both audiences: plain broadcast.
  it("relays channel.message.created into ticket:{id} with the unmodified event payload (both audiences)", () => {
    const event = {
      ticketId: "ticket-1",
      message: {
        id: "message-1",
        ticketId: "ticket-1",
        channelType: "LIVE_CHAT" as const,
        direction: "INBOUND" as const,
        senderContactId: "contact-1",
        senderUserId: null,
        body: "Hi, I need help",
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
      },
    };

    listener.onChannelMessageCreated(event);

    expect(gateway._to).toHaveBeenCalledWith("ticket:ticket-1");
    expect(gateway._emit).toHaveBeenCalledWith(CHANNEL_MESSAGE_CREATED_EVENT, event);
    expect(gateway.emitToAgentsInRoom).not.toHaveBeenCalled();
  });

  it("does not throw when server.to(...).emit(...) throws — catches and logs instead", () => {
    gateway._to.mockImplementation(() => {
      throw new Error("socket server unavailable");
    });
    const event = { ticket: ticketSummary, actorUserId: null };

    expect(() => listener.onTicketUpdated(event)).not.toThrow();
  });
});
