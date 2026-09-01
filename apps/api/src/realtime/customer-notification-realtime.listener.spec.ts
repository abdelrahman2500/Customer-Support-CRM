import { beforeEach, describe, expect, it, vi } from "vitest";
import { CustomerNotificationRealtimeListener } from "./customer-notification-realtime.listener";
import { TICKET_UPDATED_EVENT } from "../modules/tickets/tickets.events";
import { CHANNEL_MESSAGE_CREATED_EVENT } from "../modules/channels/channel-messages.events";
import type { RealtimeGateway } from "./realtime.gateway";
import type { PrismaService } from "../prisma/prisma.service";

function buildGatewayMock() {
  const emit = vi.fn();
  const to = vi.fn().mockReturnValue({ emit });
  return { server: { to }, _emit: emit, _to: to };
}

function buildPrismaMock() {
  return { ticket: { findUnique: vi.fn() } };
}

function createListener(
  gatewayMock: ReturnType<typeof buildGatewayMock>,
  prismaMock: ReturnType<typeof buildPrismaMock>,
): CustomerNotificationRealtimeListener {
  return new CustomerNotificationRealtimeListener(
    gatewayMock as unknown as RealtimeGateway,
    prismaMock as unknown as PrismaService,
  );
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

const ticketUpdatedEvent = { ticket: ticketSummary, actorUserId: "user-1" };

const agentMessageEvent = {
  ticketId: "ticket-2",
  message: {
    id: "message-1",
    ticketId: "ticket-2",
    channelType: "LIVE_CHAT" as const,
    direction: "OUTBOUND" as const,
    senderContactId: null,
    senderUserId: "user-1",
    body: "We're looking into this now.",
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
  },
};

const customerMessageEvent = {
  ticketId: "ticket-3",
  message: {
    id: "message-2",
    ticketId: "ticket-3",
    channelType: "LIVE_CHAT" as const,
    direction: "INBOUND" as const,
    senderContactId: "contact-1",
    senderUserId: null,
    body: "Any update?",
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
  },
};

describe("CustomerNotificationRealtimeListener", () => {
  let gateway: ReturnType<typeof buildGatewayMock>;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let listener: CustomerNotificationRealtimeListener;

  beforeEach(() => {
    vi.clearAllMocks();
    gateway = buildGatewayMock();
    prisma = buildPrismaMock();
    listener = createListener(gateway, prisma);
  });

  it("relays ticket.updated into customer:{customerId}:notifications with the unmodified event payload", () => {
    listener.onTicketUpdated(ticketUpdatedEvent);

    expect(gateway._to).toHaveBeenCalledWith("customer:customer-1:notifications");
    expect(gateway._emit).toHaveBeenCalledWith(TICKET_UPDATED_EVENT, ticketUpdatedEvent);
  });

  it("does not throw when server.to(...).emit(...) throws for ticket.updated — catches and logs instead", () => {
    gateway._to.mockImplementation(() => {
      throw new Error("socket server unavailable");
    });

    expect(() => listener.onTicketUpdated(ticketUpdatedEvent)).not.toThrow();
  });

  describe("onChannelMessageCreated", () => {
    it("resolves the ticket's customer and relays when the message is agent-authored (senderUserId set)", async () => {
      prisma.ticket.findUnique.mockResolvedValue({ customerId: "customer-2" });

      await listener.onChannelMessageCreated(agentMessageEvent);

      expect(prisma.ticket.findUnique).toHaveBeenCalledWith({
        where: { id: "ticket-2" },
        select: { customerId: true },
      });
      expect(gateway._to).toHaveBeenCalledWith("customer:customer-2:notifications");
      expect(gateway._emit).toHaveBeenCalledWith(CHANNEL_MESSAGE_CREATED_EVENT, agentMessageEvent);
    });

    it("never queries Prisma or relays when the message has no senderUserId (customer's own message)", async () => {
      await listener.onChannelMessageCreated(customerMessageEvent);

      expect(prisma.ticket.findUnique).not.toHaveBeenCalled();
      expect(gateway._to).not.toHaveBeenCalled();
    });

    it("does not relay when the ticket cannot be found", async () => {
      prisma.ticket.findUnique.mockResolvedValue(null);

      await listener.onChannelMessageCreated(agentMessageEvent);

      expect(gateway._to).not.toHaveBeenCalled();
    });

    it("does not throw when the Prisma lookup fails — it catches and logs instead", async () => {
      prisma.ticket.findUnique.mockRejectedValue(new Error("db unavailable"));

      await expect(listener.onChannelMessageCreated(agentMessageEvent)).resolves.toBeUndefined();
      expect(gateway._to).not.toHaveBeenCalled();
    });

    it("does not throw when server.to(...).emit(...) throws — catches and logs instead", async () => {
      prisma.ticket.findUnique.mockResolvedValue({ customerId: "customer-2" });
      gateway._to.mockImplementation(() => {
        throw new Error("socket server unavailable");
      });

      await expect(listener.onChannelMessageCreated(agentMessageEvent)).resolves.toBeUndefined();
    });
  });
});
