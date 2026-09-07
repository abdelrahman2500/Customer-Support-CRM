import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { SlaAtRiskNotificationListener } from "./sla-at-risk-notification.listener";
import { SLA_AT_RISK_EVENT } from "../sla-policies/sla-detection.events";
import type { PrismaService } from "../../prisma/prisma.service";
import type { NotificationPreferencesService } from "./notification-preferences.service";
import type { AgentNotificationEmailProducer } from "../../queues/agent-notification-email.producer";

/** Mimics the shape `PrismaClientKnownRequestError` exposes at `.code` — see
 * `sla-escalation.listener.spec.ts`'s `buildUniqueConstraintError` precedent. */
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

// RM-26 — "no row = enabled" (`inAppEnabled: true`) is the default,
// mirroring `NotificationPreferencesService.listPreferences`'s own
// convention, so every pre-existing test below (which never sets this up
// explicitly) keeps enqueueing exactly as it did before this story added
// the check.
function buildNotificationPreferencesServiceMock() {
  return {
    listPreferences: vi.fn().mockResolvedValue([{ eventType: "sla.at_risk", inAppEnabled: true }]),
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
): SlaAtRiskNotificationListener {
  return new SlaAtRiskNotificationListener(
    prismaMock as unknown as PrismaService,
    preferencesMock as unknown as NotificationPreferencesService,
    emailProducerMock as unknown as AgentNotificationEmailProducer,
  );
}

const atRiskEvent = {
  ticketId: "ticket-1",
  branchId: "branch-1",
  targetType: "response" as const,
  targetAt: new Date("2026-01-01T00:24:00.000Z"),
};

describe("SlaAtRiskNotificationListener", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let preferences: ReturnType<typeof buildNotificationPreferencesServiceMock>;
  let emailProducer: ReturnType<typeof buildAgentNotificationEmailProducerMock>;
  let listener: SlaAtRiskNotificationListener;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
    preferences = buildNotificationPreferencesServiceMock();
    emailProducer = buildAgentNotificationEmailProducerMock();
    listener = createListener(prisma, preferences, emailProducer);
    prisma.ticket.findUnique.mockResolvedValue({ assignedToUserId: "agent-1" });
  });

  describe("onSlaAtRisk", () => {
    it("persists a NotificationLog row with the event's exact fields", async () => {
      prisma.notificationLog.create.mockResolvedValue({ id: "log-1" });

      await listener.onSlaAtRisk(atRiskEvent);

      expect(prisma.notificationLog.create).toHaveBeenCalledWith({
        data: {
          eventType: SLA_AT_RISK_EVENT,
          ticketId: "ticket-1",
          branchId: "branch-1",
          targetType: "response",
          targetAt: new Date("2026-01-01T00:24:00.000Z"),
        },
      });
    });

    it("does not throw when the same transition was already logged (P2002)", async () => {
      prisma.notificationLog.create.mockRejectedValue(buildUniqueConstraintError());

      await expect(listener.onSlaAtRisk(atRiskEvent)).resolves.toBeUndefined();
    });

    it("does not throw when persistence fails for another reason", async () => {
      prisma.notificationLog.create.mockRejectedValue(new Error("db unavailable"));

      await expect(listener.onSlaAtRisk(atRiskEvent)).resolves.toBeUndefined();
    });

    it("creates a second, independent row for the same ticket/targetType when targetAt differs (post-recategorization re-entry)", async () => {
      prisma.notificationLog.create.mockResolvedValue({ id: "log-2" });
      const recomputedAtRisk = { ...atRiskEvent, targetAt: new Date("2026-01-02T00:05:00.000Z") };

      await listener.onSlaAtRisk(recomputedAtRisk);

      expect(prisma.notificationLog.create).toHaveBeenCalledWith({
        data: {
          eventType: SLA_AT_RISK_EVENT,
          ticketId: "ticket-1",
          branchId: "branch-1",
          targetType: "response",
          targetAt: new Date("2026-01-02T00:05:00.000Z"),
        },
      });
    });

    // RM-26 — Agent Email Notification Delivery.
    describe("notification email (RM-26)", () => {
      it("enqueues a notification email for the ticket's assignee once the row is newly written", async () => {
        prisma.notificationLog.create.mockResolvedValue({ id: "log-1" });

        await listener.onSlaAtRisk(atRiskEvent);

        expect(prisma.ticket.findUnique).toHaveBeenCalledWith({
          where: { id: "ticket-1" },
          select: { assignedToUserId: true },
        });
        expect(preferences.listPreferences).toHaveBeenCalledWith("agent-1");
        expect(emailProducer.enqueue).toHaveBeenCalledWith({
          ticketId: "ticket-1",
          eventType: SLA_AT_RISK_EVENT,
          recipientUserId: "agent-1",
        });
      });

      it("does not enqueue when the row was already logged (P2002) — never re-email a transition already notified", async () => {
        prisma.notificationLog.create.mockRejectedValue(buildUniqueConstraintError());

        await listener.onSlaAtRisk(atRiskEvent);

        expect(prisma.ticket.findUnique).not.toHaveBeenCalled();
        expect(emailProducer.enqueue).not.toHaveBeenCalled();
      });

      it("does not enqueue when the ticket has no assignee", async () => {
        prisma.notificationLog.create.mockResolvedValue({ id: "log-1" });
        prisma.ticket.findUnique.mockResolvedValue({ assignedToUserId: null });

        await listener.onSlaAtRisk(atRiskEvent);

        expect(preferences.listPreferences).not.toHaveBeenCalled();
        expect(emailProducer.enqueue).not.toHaveBeenCalled();
      });

      it("does not enqueue when the ticket cannot be found", async () => {
        prisma.notificationLog.create.mockResolvedValue({ id: "log-1" });
        prisma.ticket.findUnique.mockResolvedValue(null);

        await listener.onSlaAtRisk(atRiskEvent);

        expect(emailProducer.enqueue).not.toHaveBeenCalled();
      });

      it("does not enqueue when the assignee has disabled this event type", async () => {
        prisma.notificationLog.create.mockResolvedValue({ id: "log-1" });
        preferences.listPreferences.mockResolvedValue([
          { eventType: "sla.at_risk", inAppEnabled: false },
        ]);

        await listener.onSlaAtRisk(atRiskEvent);

        expect(emailProducer.enqueue).not.toHaveBeenCalled();
      });

      it("never throws when the ticket lookup fails", async () => {
        prisma.notificationLog.create.mockResolvedValue({ id: "log-1" });
        prisma.ticket.findUnique.mockRejectedValue(new Error("db unavailable"));

        await expect(listener.onSlaAtRisk(atRiskEvent)).resolves.toBeUndefined();
      });

      it("never throws when the preferences lookup fails", async () => {
        prisma.notificationLog.create.mockResolvedValue({ id: "log-1" });
        preferences.listPreferences.mockRejectedValue(new Error("db unavailable"));

        await expect(listener.onSlaAtRisk(atRiskEvent)).resolves.toBeUndefined();
      });

      it("never throws when the enqueue itself fails", async () => {
        prisma.notificationLog.create.mockResolvedValue({ id: "log-1" });
        emailProducer.enqueue.mockRejectedValue(new Error("redis unavailable"));

        await expect(listener.onSlaAtRisk(atRiskEvent)).resolves.toBeUndefined();
      });
    });
  });

  it("does not subscribe to sla.breached", () => {
    expect((listener as unknown as Record<string, unknown>).onSlaBreached).toBeUndefined();
  });

  it("subscribes to sla.at_risk", () => {
    // Sanity check that the constant this listener is decorated with matches
    // the constant SlaTimerEventsBridgeProcessor actually emits.
    expect(SLA_AT_RISK_EVENT).toBe("sla.at_risk");
  });
});
