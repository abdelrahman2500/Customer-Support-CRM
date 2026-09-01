import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { PortalNotificationLogListener } from "./portal-notification-log.listener";
import { TICKET_UPDATED_EVENT } from "../tickets/tickets.events";
import { CHANNEL_MESSAGE_CREATED_EVENT } from "../channels/channel-messages.events";
import type { PrismaService } from "../../prisma/prisma.service";

/** Mimics the shape `PrismaClientKnownRequestError` exposes at `.code` — see
 * `sla-at-risk-notification.listener.spec.ts`'s `buildUniqueConstraintError` precedent. */
function buildUniqueConstraintError(): Prisma.PrismaClientKnownRequestError {
  return Object.assign(Object.create(Prisma.PrismaClientKnownRequestError.prototype), {
    code: "P2002",
    message: "Unique constraint failed",
  }) as Prisma.PrismaClientKnownRequestError;
}

function buildPrismaMock() {
  return {
    notificationLog: {
      create: vi.fn(),
    },
    ticket: {
      findUnique: vi.fn(),
    },
  };
}

function createListener(
  prismaMock: ReturnType<typeof buildPrismaMock>,
): PortalNotificationLogListener {
  return new PortalNotificationLogListener(prismaMock as unknown as PrismaService);
}

const updatedEvent = {
  ticket: {
    id: "ticket-1",
    subject: "Cannot log in",
    category: "billing",
    priority: "URGENT" as const,
    status: "OPEN" as const,
    customerId: "customer-1",
    contactId: null,
    departmentId: null,
    assignedToUserId: null,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-02T00:00:00.000Z"),
  },
  actorUserId: "agent-1",
};

describe("PortalNotificationLogListener", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let listener: PortalNotificationLogListener;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
    listener = createListener(prisma);
  });

  describe("onTicketUpdated", () => {
    it("persists a NotificationLog row scoped to the ticket's customerId, with a ticketId:updatedAt dedupeKey", async () => {
      prisma.notificationLog.create.mockResolvedValue({ id: "log-1" });

      await listener.onTicketUpdated(updatedEvent);

      expect(prisma.notificationLog.create).toHaveBeenCalledWith({
        data: {
          eventType: TICKET_UPDATED_EVENT,
          ticketId: "ticket-1",
          customerId: "customer-1",
          dedupeKey: "ticket-1:2024-01-02T00:00:00.000Z",
        },
      });
    });

    it("does not throw when the exact same update is already logged (P2002)", async () => {
      prisma.notificationLog.create.mockRejectedValue(buildUniqueConstraintError());

      await expect(listener.onTicketUpdated(updatedEvent)).resolves.toBeUndefined();
    });

    it("does not throw when persistence fails for another reason", async () => {
      prisma.notificationLog.create.mockRejectedValue(new Error("db unavailable"));

      await expect(listener.onTicketUpdated(updatedEvent)).resolves.toBeUndefined();
    });
  });

  describe("onChannelMessageCreated", () => {
    const agentReplyEvent = {
      ticketId: "ticket-1",
      message: {
        id: "message-1",
        ticketId: "ticket-1",
        channelType: "LIVE_CHAT" as const,
        direction: "OUTBOUND" as const,
        senderContactId: null,
        senderUserId: "agent-1",
        body: "We're looking into this.",
        createdAt: new Date("2024-01-02T00:00:00.000Z"),
      },
    };

    const customerMessageEvent = {
      ticketId: "ticket-1",
      message: {
        ...agentReplyEvent.message,
        id: "message-2",
        direction: "INBOUND" as const,
        senderContactId: "contact-1",
        senderUserId: null,
      },
    };

    it("persists a NotificationLog row when the message is an agent reply (senderUserId set)", async () => {
      prisma.ticket.findUnique.mockResolvedValue({ customerId: "customer-1" });
      prisma.notificationLog.create.mockResolvedValue({ id: "log-1" });

      await listener.onChannelMessageCreated(agentReplyEvent);

      expect(prisma.ticket.findUnique).toHaveBeenCalledWith({
        where: { id: "ticket-1" },
        select: { customerId: true },
      });
      expect(prisma.notificationLog.create).toHaveBeenCalledWith({
        data: {
          eventType: CHANNEL_MESSAGE_CREATED_EVENT,
          ticketId: "ticket-1",
          customerId: "customer-1",
          dedupeKey: "message-1",
        },
      });
    });

    it("does nothing for the customer's own message (senderUserId null) — no ticket lookup, no write", async () => {
      await listener.onChannelMessageCreated(customerMessageEvent);

      expect(prisma.ticket.findUnique).not.toHaveBeenCalled();
      expect(prisma.notificationLog.create).not.toHaveBeenCalled();
    });

    it("skips silently when the ticket cannot be found", async () => {
      prisma.ticket.findUnique.mockResolvedValue(null);

      await listener.onChannelMessageCreated(agentReplyEvent);

      expect(prisma.notificationLog.create).not.toHaveBeenCalled();
    });

    it("does not throw when the same message already has a logged notification (P2002)", async () => {
      prisma.ticket.findUnique.mockResolvedValue({ customerId: "customer-1" });
      prisma.notificationLog.create.mockRejectedValue(buildUniqueConstraintError());

      await expect(listener.onChannelMessageCreated(agentReplyEvent)).resolves.toBeUndefined();
    });

    it("does not throw when the ticket lookup fails", async () => {
      prisma.ticket.findUnique.mockRejectedValue(new Error("db unavailable"));

      await expect(listener.onChannelMessageCreated(agentReplyEvent)).resolves.toBeUndefined();
    });
  });
});
