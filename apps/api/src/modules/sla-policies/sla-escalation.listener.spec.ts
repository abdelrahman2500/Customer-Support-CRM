import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EventEmitter2 } from "@nestjs/event-emitter";
import { Prisma } from "@prisma/client";
import { SlaEscalationListener } from "./sla-escalation.listener";
import { SLA_BREACHED_EVENT, SLA_ESCALATED_EVENT } from "./sla-detection.events";
import type { PrismaService } from "../../prisma/prisma.service";

/** Mimics the shape `PrismaClientKnownRequestError` exposes at `.code` — see
 * `customers.service.spec.ts`'s `buildUniqueConstraintError` precedent. */
function buildUniqueConstraintError(): Prisma.PrismaClientKnownRequestError {
  return Object.assign(Object.create(Prisma.PrismaClientKnownRequestError.prototype), {
    code: "P2002",
    message: "Unique constraint failed",
  }) as Prisma.PrismaClientKnownRequestError;
}

function buildPrismaMock() {
  return {
    slaEscalation: {
      create: vi.fn(),
    },
  };
}

function buildEventEmitterMock() {
  return { emit: vi.fn() };
}

function createListener(
  prismaMock: ReturnType<typeof buildPrismaMock>,
  eventEmitterMock: ReturnType<typeof buildEventEmitterMock>,
): SlaEscalationListener {
  return new SlaEscalationListener(
    prismaMock as unknown as PrismaService,
    eventEmitterMock as unknown as EventEmitter2,
  );
}

const breachedEvent = {
  ticketId: "ticket-1",
  branchId: "branch-1",
  targetType: "response" as const,
  targetAt: new Date("2026-01-01T00:30:00.000Z"),
};

describe("SlaEscalationListener", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let eventEmitter: ReturnType<typeof buildEventEmitterMock>;
  let listener: SlaEscalationListener;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
    eventEmitter = buildEventEmitterMock();
    listener = createListener(prisma, eventEmitter);
  });

  describe("onSlaBreached", () => {
    it("persists an SlaEscalation row with the event's exact fields", async () => {
      prisma.slaEscalation.create.mockResolvedValue({ id: "escalation-1" });

      await listener.onSlaBreached(breachedEvent);

      expect(prisma.slaEscalation.create).toHaveBeenCalledWith({
        data: {
          ticketId: "ticket-1",
          branchId: "branch-1",
          targetType: "response",
          targetAt: new Date("2026-01-01T00:30:00.000Z"),
        },
      });
    });

    it("emits sla.escalated with the identical ticketId/branchId/targetType/targetAt after a successful persist", async () => {
      prisma.slaEscalation.create.mockResolvedValue({ id: "escalation-1" });

      await listener.onSlaBreached(breachedEvent);

      expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
      expect(eventEmitter.emit).toHaveBeenCalledWith(SLA_ESCALATED_EVENT, {
        ticketId: "ticket-1",
        branchId: "branch-1",
        targetType: "response",
        targetAt: new Date("2026-01-01T00:30:00.000Z"),
      });
    });

    it("does not throw and does not emit when the same transition was already escalated (P2002)", async () => {
      prisma.slaEscalation.create.mockRejectedValue(buildUniqueConstraintError());

      await expect(listener.onSlaBreached(breachedEvent)).resolves.toBeUndefined();

      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it("does not throw and does not emit when persistence fails for another reason", async () => {
      prisma.slaEscalation.create.mockRejectedValue(new Error("db unavailable"));

      await expect(listener.onSlaBreached(breachedEvent)).resolves.toBeUndefined();

      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it("creates a second, independent row for the same ticket/targetType when targetAt differs (post-recategorization re-breach)", async () => {
      prisma.slaEscalation.create.mockResolvedValue({ id: "escalation-2" });
      const recomputedBreach = { ...breachedEvent, targetAt: new Date("2026-01-02T00:10:00.000Z") };

      await listener.onSlaBreached(recomputedBreach);

      expect(prisma.slaEscalation.create).toHaveBeenCalledWith({
        data: {
          ticketId: "ticket-1",
          branchId: "branch-1",
          targetType: "response",
          targetAt: new Date("2026-01-02T00:10:00.000Z"),
        },
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        SLA_ESCALATED_EVENT,
        expect.objectContaining({ targetAt: new Date("2026-01-02T00:10:00.000Z") }),
      );
    });
  });

  it("does not subscribe to sla.at_risk", () => {
    expect((listener as unknown as Record<string, unknown>).onSlaAtRisk).toBeUndefined();
  });

  it("subscribes to sla.breached", () => {
    // Sanity check that the constant this listener is decorated with matches
    // the constant SlaTimerEventsBridgeProcessor actually emits.
    expect(SLA_BREACHED_EVENT).toBe("sla.breached");
  });
});
