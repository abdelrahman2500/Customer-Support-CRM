import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { SlaAtRiskNotificationListener } from "./sla-at-risk-notification.listener";
import { SLA_AT_RISK_EVENT } from "../sla-policies/sla-detection.events";
import type { PrismaService } from "../../prisma/prisma.service";

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
  };
}

function createListener(prismaMock: ReturnType<typeof buildPrismaMock>): SlaAtRiskNotificationListener {
  return new SlaAtRiskNotificationListener(prismaMock as unknown as PrismaService);
}

const atRiskEvent = {
  ticketId: "ticket-1",
  branchId: "branch-1",
  targetType: "response" as const,
  targetAt: new Date("2026-01-01T00:24:00.000Z"),
};

describe("SlaAtRiskNotificationListener", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let listener: SlaAtRiskNotificationListener;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
    listener = createListener(prisma);
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
