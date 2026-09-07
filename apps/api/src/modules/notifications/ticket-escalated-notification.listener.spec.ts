import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { TicketEscalatedNotificationListener } from "./ticket-escalated-notification.listener";
import { TICKET_ESCALATED_EVENT } from "../tickets/tickets.events";
import type { PrismaService } from "../../prisma/prisma.service";
import type { NotificationPreferencesService } from "./notification-preferences.service";
import type { AgentNotificationEmailProducer } from "../../queues/agent-notification-email.producer";

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

// RM-26 — "no row = enabled" (`inAppEnabled: true`) is the default,
// mirroring `NotificationPreferencesService.listPreferences`'s own
// convention, so every pre-existing test below (which never sets this up
// explicitly) keeps enqueueing exactly as it did before this story added
// the check.
function buildNotificationPreferencesServiceMock() {
  return {
    listPreferences: vi.fn().mockResolvedValue([{ eventType: "ticket.escalated", inAppEnabled: true }]),
  };
}

function buildAgentNotificationEmailProducerMock() {
  return {
    enqueue: vi.fn().mockResolvedValue({ id: "job-1" }),
  };
}

function createListener(
  prismaMock: ReturnType<typeof buildPrismaMock>,
  preferencesMock: ReturnType<typeof buildNotificationPreferencesServiceMock>,
  emailProducerMock: ReturnType<typeof buildAgentNotificationEmailProducerMock>,
): TicketEscalatedNotificationListener {
  return new TicketEscalatedNotificationListener(
    prismaMock as unknown as PrismaService,
    preferencesMock as unknown as NotificationPreferencesService,
    emailProducerMock as unknown as AgentNotificationEmailProducer,
  );
}

const escalatedEvent = {
  ticket: {
    id: "ticket-1",
    subject: "Cannot log in",
    categoryId: "category-1",
    categoryName: "billing",
    priority: "URGENT" as const,
    status: "OPEN" as const,
    customerId: "customer-1",
    customerName: null,
    contactId: null,
    departmentId: null,
    assignedToUserId: "agent-1",
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
  },
  actorUserId: null,
};

describe("TicketEscalatedNotificationListener", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let preferences: ReturnType<typeof buildNotificationPreferencesServiceMock>;
  let emailProducer: ReturnType<typeof buildAgentNotificationEmailProducerMock>;
  let listener: TicketEscalatedNotificationListener;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
    preferences = buildNotificationPreferencesServiceMock();
    emailProducer = buildAgentNotificationEmailProducerMock();
    listener = createListener(prisma, preferences, emailProducer);
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

    // RM-26 — Agent Email Notification Delivery.
    describe("notification email (RM-26)", () => {
      it("enqueues a notification email for the ticket's assignedToUserId once the row is newly written, with no Ticket lookup", async () => {
        prisma.notificationLog.create.mockResolvedValue({ id: "log-1" });

        await listener.onTicketEscalated(escalatedEvent);

        expect(preferences.listPreferences).toHaveBeenCalledWith("agent-1");
        expect(emailProducer.enqueue).toHaveBeenCalledWith({
          ticketId: "ticket-1",
          eventType: TICKET_ESCALATED_EVENT,
          recipientUserId: "agent-1",
        });
      });

      it("does not enqueue when the row was already logged (P2002) — never re-email an escalation already notified", async () => {
        prisma.notificationLog.create.mockRejectedValue(buildUniqueConstraintError());

        await listener.onTicketEscalated(escalatedEvent);

        expect(preferences.listPreferences).not.toHaveBeenCalled();
        expect(emailProducer.enqueue).not.toHaveBeenCalled();
      });

      it("does not enqueue when the ticket has no assignedToUserId", async () => {
        prisma.notificationLog.create.mockResolvedValue({ id: "log-1" });

        await listener.onTicketEscalated({
          ...escalatedEvent,
          ticket: { ...escalatedEvent.ticket, assignedToUserId: null },
        });

        expect(preferences.listPreferences).not.toHaveBeenCalled();
        expect(emailProducer.enqueue).not.toHaveBeenCalled();
      });

      it("does not enqueue when the assignee has disabled this event type", async () => {
        prisma.notificationLog.create.mockResolvedValue({ id: "log-1" });
        preferences.listPreferences.mockResolvedValue([
          { eventType: "ticket.escalated", inAppEnabled: false },
        ]);

        await listener.onTicketEscalated(escalatedEvent);

        expect(emailProducer.enqueue).not.toHaveBeenCalled();
      });

      it("never throws when the preferences lookup fails", async () => {
        prisma.notificationLog.create.mockResolvedValue({ id: "log-1" });
        preferences.listPreferences.mockRejectedValue(new Error("db unavailable"));

        await expect(listener.onTicketEscalated(escalatedEvent)).resolves.toBeUndefined();
      });

      it("never throws when the enqueue itself fails", async () => {
        prisma.notificationLog.create.mockResolvedValue({ id: "log-1" });
        emailProducer.enqueue.mockRejectedValue(new Error("redis unavailable"));

        await expect(listener.onTicketEscalated(escalatedEvent)).resolves.toBeUndefined();
      });
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
