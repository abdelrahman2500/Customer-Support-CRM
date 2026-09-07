import { beforeEach, describe, expect, it, vi } from "vitest";
import { SlaHoldListener } from "./sla-hold.listener";
import type { TicketSummary } from "../tickets/tickets.service";
import type { PrismaService } from "../../prisma/prisma.service";

function buildPrismaMock() {
  return {
    slaTicketTarget: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
}

function createListener(prismaMock: ReturnType<typeof buildPrismaMock>): SlaHoldListener {
  return new SlaHoldListener(prismaMock as unknown as PrismaService);
}

const ticket: TicketSummary = {
  id: "ticket-1",
  subject: "Cannot log in",
  categoryId: null,
  categoryName: null,
  priority: "MEDIUM",
  status: "OPEN",
  customerId: "customer-1",
  customerName: null,
  contactId: null,
  departmentId: null,
  assignedToUserId: null,
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  updatedAt: new Date("2024-01-01T00:00:00.000Z"),
};

const event = { ticket, actorUserId: "agent-1" };

describe("SlaHoldListener", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let listener: SlaHoldListener;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
    listener = createListener(prisma);
  });

  describe("onTicketOnHold", () => {
    it("sets onHoldSince to now when a pending, not-already-on-hold target exists", async () => {
      prisma.slaTicketTarget.findUnique.mockResolvedValue({
        id: "target-1",
        ticketId: "ticket-1",
        onHoldSince: null,
        responseTargetAt: new Date("2024-01-01T01:00:00.000Z"),
        resolutionTargetAt: new Date("2024-01-01T04:00:00.000Z"),
      });

      await listener.onTicketOnHold(event);

      expect(prisma.slaTicketTarget.update).toHaveBeenCalledWith({
        where: { ticketId: "ticket-1" },
        data: { onHoldSince: expect.any(Date) },
      });
    });

    it("does nothing when the ticket has no SlaTicketTarget at all", async () => {
      prisma.slaTicketTarget.findUnique.mockResolvedValue(null);

      await listener.onTicketOnHold(event);

      expect(prisma.slaTicketTarget.update).not.toHaveBeenCalled();
    });

    it("does nothing when the target is already on hold", async () => {
      prisma.slaTicketTarget.findUnique.mockResolvedValue({
        id: "target-1",
        ticketId: "ticket-1",
        onHoldSince: new Date("2024-01-01T00:30:00.000Z"),
        responseTargetAt: new Date("2024-01-01T01:00:00.000Z"),
        resolutionTargetAt: new Date("2024-01-01T04:00:00.000Z"),
      });

      await listener.onTicketOnHold(event);

      expect(prisma.slaTicketTarget.update).not.toHaveBeenCalled();
    });

    it("never throws when the lookup fails", async () => {
      prisma.slaTicketTarget.findUnique.mockRejectedValue(new Error("db unavailable"));

      await expect(listener.onTicketOnHold(event)).resolves.toBeUndefined();
    });

    it("never throws when the update fails", async () => {
      prisma.slaTicketTarget.findUnique.mockResolvedValue({
        id: "target-1",
        ticketId: "ticket-1",
        onHoldSince: null,
        responseTargetAt: new Date("2024-01-01T01:00:00.000Z"),
        resolutionTargetAt: new Date("2024-01-01T04:00:00.000Z"),
      });
      prisma.slaTicketTarget.update.mockRejectedValue(new Error("db unavailable"));

      await expect(listener.onTicketOnHold(event)).resolves.toBeUndefined();
    });
  });

  describe("onTicketResumed", () => {
    it("does nothing when the ticket has no SlaTicketTarget at all", async () => {
      prisma.slaTicketTarget.findUnique.mockResolvedValue(null);

      await listener.onTicketResumed(event);

      expect(prisma.slaTicketTarget.update).not.toHaveBeenCalled();
    });

    it("does nothing when the target is not currently on hold", async () => {
      prisma.slaTicketTarget.findUnique.mockResolvedValue({
        id: "target-1",
        ticketId: "ticket-1",
        onHoldSince: null,
        responseTargetAt: new Date("2024-01-01T01:00:00.000Z"),
        resolutionTargetAt: new Date("2024-01-01T04:00:00.000Z"),
      });

      await listener.onTicketResumed(event);

      expect(prisma.slaTicketTarget.update).not.toHaveBeenCalled();
    });

    it("shifts both targets forward by the exact held duration when both were still pending", async () => {
      const onHoldSince = new Date("2024-01-01T00:00:00.000Z");
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-01T00:30:00.000Z")); // held for 30 minutes
      prisma.slaTicketTarget.findUnique.mockResolvedValue({
        id: "target-1",
        ticketId: "ticket-1",
        onHoldSince,
        responseTargetAt: new Date("2024-01-01T01:00:00.000Z"),
        resolutionTargetAt: new Date("2024-01-01T04:00:00.000Z"),
      });

      await listener.onTicketResumed(event);

      expect(prisma.slaTicketTarget.update).toHaveBeenCalledWith({
        where: { ticketId: "ticket-1" },
        data: {
          onHoldSince: null,
          responseTargetAt: new Date("2024-01-01T01:30:00.000Z"),
          resolutionTargetAt: new Date("2024-01-01T04:30:00.000Z"),
        },
      });
      vi.useRealTimers();
    });

    // RM-25's own explicit acceptance criterion: holding does not
    // retroactively un-breach a target already passed before the hold began.
    it("leaves a target that had already passed before the hold began completely unchanged", async () => {
      const onHoldSince = new Date("2024-01-01T02:00:00.000Z");
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-01T03:00:00.000Z")); // held for 1 hour
      prisma.slaTicketTarget.findUnique.mockResolvedValue({
        id: "target-1",
        ticketId: "ticket-1",
        onHoldSince,
        // response target already passed before the hold began (01:00 < 02:00 onHoldSince)
        responseTargetAt: new Date("2024-01-01T01:00:00.000Z"),
        // resolution target was still pending when the hold began
        resolutionTargetAt: new Date("2024-01-01T05:00:00.000Z"),
      });

      await listener.onTicketResumed(event);

      expect(prisma.slaTicketTarget.update).toHaveBeenCalledWith({
        where: { ticketId: "ticket-1" },
        data: {
          onHoldSince: null,
          responseTargetAt: new Date("2024-01-01T01:00:00.000Z"), // unchanged
          resolutionTargetAt: new Date("2024-01-01T06:00:00.000Z"), // +1h
        },
      });
      vi.useRealTimers();
    });

    it("never throws when the lookup fails", async () => {
      prisma.slaTicketTarget.findUnique.mockRejectedValue(new Error("db unavailable"));

      await expect(listener.onTicketResumed(event)).resolves.toBeUndefined();
    });

    it("never throws when the update fails", async () => {
      prisma.slaTicketTarget.findUnique.mockResolvedValue({
        id: "target-1",
        ticketId: "ticket-1",
        onHoldSince: new Date("2024-01-01T00:00:00.000Z"),
        responseTargetAt: new Date("2024-01-01T01:00:00.000Z"),
        resolutionTargetAt: new Date("2024-01-01T04:00:00.000Z"),
      });
      prisma.slaTicketTarget.update.mockRejectedValue(new Error("db unavailable"));

      await expect(listener.onTicketResumed(event)).resolves.toBeUndefined();
    });
  });
});
