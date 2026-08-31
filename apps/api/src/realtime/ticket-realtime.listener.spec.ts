import { beforeEach, describe, expect, it, vi } from "vitest";
import { TicketRealtimeListener } from "./ticket-realtime.listener";
import {
  TICKET_UPDATED_EVENT,
  TICKET_ESCALATED_EVENT,
  TICKET_NOTE_ADDED_EVENT,
} from "../modules/tickets/tickets.events";
import { AI_PROMPT_COMPLETED_EVENT } from "../modules/ai/ai.events";
import type { RealtimeGateway } from "./realtime.gateway";

function buildGatewayMock() {
  const emit = vi.fn();
  const to = vi.fn().mockReturnValue({ emit });
  return { server: { to }, _emit: emit, _to: to };
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

  it("relays ticket.updated into ticket:{id} with the unmodified event payload", () => {
    const event = { ticket: ticketSummary, actorUserId: "user-1" };

    listener.onTicketUpdated(event);

    expect(gateway._to).toHaveBeenCalledWith("ticket:ticket-1");
    expect(gateway._emit).toHaveBeenCalledWith(TICKET_UPDATED_EVENT, event);
  });

  it("relays ticket.escalated into ticket:{id} with the unmodified event payload", () => {
    const event = { ticket: ticketSummary, actorUserId: null };

    listener.onTicketEscalated(event);

    expect(gateway._to).toHaveBeenCalledWith("ticket:ticket-1");
    expect(gateway._emit).toHaveBeenCalledWith(TICKET_ESCALATED_EVENT, event);
  });

  it("relays ticket.note-added into ticket:{id} with the unmodified event payload (Story 50)", () => {
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

    expect(gateway._to).toHaveBeenCalledWith("ticket:ticket-1");
    expect(gateway._emit).toHaveBeenCalledWith(TICKET_NOTE_ADDED_EVENT, event);
  });

  it("relays ai.prompt_completed into ticket:{id} with the unmodified event payload (Story 76)", () => {
    const event = {
      aiPromptLogId: "log-1",
      ticketId: "ticket-1",
      feature: "SUMMARIZE" as const,
      outcome: "SUCCESS" as const,
    };

    listener.onAiPromptCompleted(event);

    expect(gateway._to).toHaveBeenCalledWith("ticket:ticket-1");
    expect(gateway._emit).toHaveBeenCalledWith(AI_PROMPT_COMPLETED_EVENT, event);
  });

  it("does not throw when server.to(...).emit(...) throws — catches and logs instead", () => {
    gateway._to.mockImplementation(() => {
      throw new Error("socket server unavailable");
    });
    const event = { ticket: ticketSummary, actorUserId: null };

    expect(() => listener.onTicketUpdated(event)).not.toThrow();
  });
});
