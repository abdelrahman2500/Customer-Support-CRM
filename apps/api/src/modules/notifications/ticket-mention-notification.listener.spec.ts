import { beforeEach, describe, expect, it, vi } from "vitest";
import { TicketMentionNotificationListener } from "./ticket-mention-notification.listener";
import { TICKET_MENTIONED_EVENT } from "../tickets/tickets.events";
import type { PrismaService } from "../../prisma/prisma.service";
import type { AgentNotificationEmailProducer } from "../../queues/agent-notification-email.producer";

function buildPrismaMock() {
  return {
    notificationLog: {
      create: vi.fn(),
    },
  };
}

function buildAgentNotificationEmailProducerMock() {
  return {
    enqueue: vi.fn().mockResolvedValue({ id: "job-1" }),
  };
}

function createListener(
  prismaMock: ReturnType<typeof buildPrismaMock>,
  emailProducerMock: ReturnType<typeof buildAgentNotificationEmailProducerMock>,
): TicketMentionNotificationListener {
  return new TicketMentionNotificationListener(
    prismaMock as unknown as PrismaService,
    emailProducerMock as unknown as AgentNotificationEmailProducer,
  );
}

const mentionEvent = {
  ticketId: "ticket-1",
  noteId: "note-1",
  recipientUserId: "user-2",
  actorUserId: "user-1",
};

describe("TicketMentionNotificationListener", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let emailProducer: ReturnType<typeof buildAgentNotificationEmailProducerMock>;
  let listener: TicketMentionNotificationListener;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
    emailProducer = buildAgentNotificationEmailProducerMock();
    listener = createListener(prisma, emailProducer);
  });

  describe("onTicketMentioned", () => {
    it("persists a NotificationLog row with eventType/ticketId/recipientUserId set from the event", async () => {
      prisma.notificationLog.create.mockResolvedValue({ id: "log-1" });

      await listener.onTicketMentioned(mentionEvent);

      expect(prisma.notificationLog.create).toHaveBeenCalledWith({
        data: {
          eventType: TICKET_MENTIONED_EVENT,
          ticketId: "ticket-1",
          recipientUserId: "user-2",
        },
      });
    });

    it("does not throw when persistence fails — catches and logs instead", async () => {
      prisma.notificationLog.create.mockRejectedValue(new Error("db unavailable"));

      await expect(listener.onTicketMentioned(mentionEvent)).resolves.toBeUndefined();
    });

    it("does not enqueue a notification email when persistence fails", async () => {
      prisma.notificationLog.create.mockRejectedValue(new Error("db unavailable"));

      await listener.onTicketMentioned(mentionEvent);

      expect(emailProducer.enqueue).not.toHaveBeenCalled();
    });

    // RM-26 — Agent Email Notification Delivery.
    describe("notification email (RM-26)", () => {
      it("enqueues a notification email for the mentioned agent, unconditionally (no preference gate)", async () => {
        prisma.notificationLog.create.mockResolvedValue({ id: "log-1" });

        await listener.onTicketMentioned(mentionEvent);

        expect(emailProducer.enqueue).toHaveBeenCalledWith({
          ticketId: "ticket-1",
          eventType: TICKET_MENTIONED_EVENT,
          recipientUserId: "user-2",
        });
      });

      it("never throws when the enqueue itself fails", async () => {
        prisma.notificationLog.create.mockResolvedValue({ id: "log-1" });
        emailProducer.enqueue.mockRejectedValue(new Error("redis unavailable"));

        await expect(listener.onTicketMentioned(mentionEvent)).resolves.toBeUndefined();
      });
    });
  });

  it("subscribes to ticket.mentioned", () => {
    expect(TICKET_MENTIONED_EVENT).toBe("ticket.mentioned");
  });
});
