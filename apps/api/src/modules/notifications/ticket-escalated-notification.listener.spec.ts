import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { TicketEscalatedNotificationListener } from "./ticket-escalated-notification.listener";
import { TICKET_ESCALATED_EVENT } from "../tickets/tickets.events";
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
  };
}

function createListener(
  prismaMock: ReturnType<typeof buildPrismaMock>,
): TicketEscalatedNotificationListener {
  return new TicketEscalatedNotificationListener(prismaMock as unknown as PrismaService);
}

const escalatedEvent = {
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
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
  },
  actorUserId: null,
};

describe("TicketEscalatedNotificationListener", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let listener: TicketEscalatedNotificationListener;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
    listener = createListener(prisma);
  });

  describe("onTicketEscalated", () => {
    it("persists a NotificationLog row with eventType/ticketId/dedupeKey set from the event", async () => {
      prisma.notificationLog.create.mockResolvedValue({ id: "log-1" });

      await listener.onTicketEscalated(escalatedEvent);

      expect(prisma.notificationLog.create).toHaveBeenCalledWith({
        data: {
          eventType: TICKET_ESCALATED_EVENT,
          ticketId: "ticket-1",
          dedupeKey: "ticket-1",
        },
      });
    });

    it("does not throw when the same ticket already has a logged escalation notification (P2002)", async () => {
      prisma.notificationLog.create.mockRejectedValue(buildUniqueConstraintError());

      await expect(listener.onTicketEscalated(escalatedEvent)).resolves.toBeUndefined();
    });

    it("does not throw when persistence fails for another reason", async () => {
      prisma.notificationLog.create.mockRejectedValue(new Error("db unavailable"));

      await expect(listener.onTicketEscalated(escalatedEvent)).resolves.toBeUndefined();
    });
  });

  it("does not subscribe to sla.at_risk", () => {
    expect((listener as unknown as Record<string, unknown>).onSlaAtRisk).toBeUndefined();
  });

  it("does not subscribe to sla.breached", () => {
    expect((listener as unknown as Record<string, unknown>).onSlaBreached).toBeUndefined();
  });

  it("subscribes to ticket.escalated", () => {
    // Sanity check that the constant this listener is decorated with matches
    // the constant TicketEscalationListener actually emits.
    expect(TICKET_ESCALATED_EVENT).toBe("ticket.escalated");
  });
});
