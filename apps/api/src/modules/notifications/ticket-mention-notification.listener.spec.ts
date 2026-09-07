import { beforeEach, describe, expect, it, vi } from "vitest";
import { TicketMentionNotificationListener } from "./ticket-mention-notification.listener";
import { TICKET_MENTIONED_EVENT } from "../tickets/tickets.events";
import type { PrismaService } from "../../prisma/prisma.service";

function buildPrismaMock() {
  return {
    notificationLog: {
      create: vi.fn(),
    },
  };
}

function createListener(
  prismaMock: ReturnType<typeof buildPrismaMock>,
): TicketMentionNotificationListener {
  return new TicketMentionNotificationListener(prismaMock as unknown as PrismaService);
}

const mentionEvent = {
  ticketId: "ticket-1",
  noteId: "note-1",
  recipientUserId: "user-2",
  actorUserId: "user-1",
};

describe("TicketMentionNotificationListener", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let listener: TicketMentionNotificationListener;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
    listener = createListener(prisma);
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
  });

  it("subscribes to ticket.mentioned", () => {
    expect(TICKET_MENTIONED_EVENT).toBe("ticket.mentioned");
  });
});
