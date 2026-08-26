import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SlaTimerProcessor } from "./sla-timer.processor";
import type { PrismaService } from "../prisma/prisma.service";
import type { Queue } from "bullmq";

function buildPrismaMock() {
  return {
    slaTicketTarget: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  };
}

function buildHandbackQueueMock() {
  return {
    add: vi.fn(),
  };
}

function createProcessor(
  prismaMock: ReturnType<typeof buildPrismaMock>,
  queueMock: ReturnType<typeof buildHandbackQueueMock>,
): SlaTimerProcessor {
  return new SlaTimerProcessor(prismaMock as unknown as PrismaService, queueMock as unknown as Queue);
}

function candidateRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "target-1",
    responseTargetAt: new Date("2026-01-01T10:00:00.000Z"),
    resolutionTargetAt: new Date("2026-01-02T10:00:00.000Z"),
    responseAtRiskNotifiedAt: null,
    responseBreachedNotifiedAt: null,
    resolutionAtRiskNotifiedAt: null,
    resolutionBreachedNotifiedAt: null,
    ticket: { id: "ticket-1", branchId: "branch-1" },
    slaPolicy: { responseTargetMinutes: 100, resolutionTargetMinutes: 1000 },
    ...overrides,
  };
}

describe("SlaTimerProcessor", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let handbackQueue: ReturnType<typeof buildHandbackQueueMock>;
  let processor: SlaTimerProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
    handbackQueue = buildHandbackQueueMock();
    processor = createProcessor(prisma, handbackQueue);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T11:00:00.000Z")); // after response targetAt, well before resolution
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("process", () => {
    it("queries candidates scoped to not-yet-breached targets on relevant ticket statuses", async () => {
      prisma.slaTicketTarget.findMany.mockResolvedValue([]);

      await processor.process({} as never);

      expect(prisma.slaTicketTarget.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ responseBreachedNotifiedAt: null }, { resolutionBreachedNotifiedAt: null }],
            ticket: { status: { in: ["OPEN", "IN_PROGRESS"] } },
          }),
        }),
      );
    });

    it("claims and enqueues exactly one hand-back job when a transition fires", async () => {
      prisma.slaTicketTarget.findMany.mockResolvedValue([candidateRow()]);
      prisma.slaTicketTarget.updateMany.mockResolvedValue({ count: 1 });

      await processor.process({} as never);

      // response is breached (now 11:00 > targetAt 10:00); resolution is
      // untouched (targetAt is the next day, well outside its own at-risk window).
      expect(prisma.slaTicketTarget.updateMany).toHaveBeenCalledTimes(1);
      expect(prisma.slaTicketTarget.updateMany).toHaveBeenCalledWith({
        where: { id: "target-1", responseBreachedNotifiedAt: null },
        data: { responseBreachedNotifiedAt: new Date("2026-01-01T11:00:00.000Z") },
      });
      expect(handbackQueue.add).toHaveBeenCalledTimes(1);
      expect(handbackQueue.add).toHaveBeenCalledWith("sla-detection", {
        eventType: "sla.breached",
        ticketId: "ticket-1",
        branchId: "branch-1",
        targetType: "response",
        targetAt: "2026-01-01T10:00:00.000Z",
      });
    });

    it("does not enqueue when the conditional update loses the race (count 0)", async () => {
      prisma.slaTicketTarget.findMany.mockResolvedValue([candidateRow()]);
      prisma.slaTicketTarget.updateMany.mockResolvedValue({ count: 0 });

      await processor.process({} as never);

      expect(handbackQueue.add).not.toHaveBeenCalled();
    });

    it("evaluates response and resolution independently for the same row", async () => {
      // Move "now" so both response (breach) and resolution (at-risk) fire
      // for the same row in one tick.
      vi.setSystemTime(new Date("2026-01-02T09:50:00.000Z"));
      prisma.slaTicketTarget.findMany.mockResolvedValue([candidateRow()]);
      prisma.slaTicketTarget.updateMany.mockResolvedValue({ count: 1 });

      await processor.process({} as never);

      expect(prisma.slaTicketTarget.updateMany).toHaveBeenCalledTimes(2);
      expect(handbackQueue.add).toHaveBeenCalledTimes(2);
      const eventTypes = handbackQueue.add.mock.calls.map((call) => (call[1] as { eventType: string }).eventType);
      expect(eventTypes.sort()).toEqual(["sla.at_risk", "sla.breached"].sort());
    });

    it("skips a row entirely when neither response nor resolution has a transition", async () => {
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z")); // well before anything
      prisma.slaTicketTarget.findMany.mockResolvedValue([candidateRow()]);

      await processor.process({} as never);

      expect(prisma.slaTicketTarget.updateMany).not.toHaveBeenCalled();
      expect(handbackQueue.add).not.toHaveBeenCalled();
    });
  });
});
