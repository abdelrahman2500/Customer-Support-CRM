import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EventEmitter2 } from "@nestjs/event-emitter";
import { TicketEscalationListener } from "./ticket-escalation.listener";
import { SLA_ESCALATED_EVENT } from "../sla-policies/sla-detection.events";
import { TICKET_ESCALATED_EVENT } from "./tickets.events";
import type { PrismaService } from "../../prisma/prisma.service";

function buildPrismaMock() {
  return {
    ticket: {
      findUnique: vi.fn(),
    },
  };
}

function buildEventEmitterMock() {
  return { emit: vi.fn() };
}

function createListener(
  prismaMock: ReturnType<typeof buildPrismaMock>,
  eventEmitterMock: ReturnType<typeof buildEventEmitterMock>,
): TicketEscalationListener {
  return new TicketEscalationListener(
    prismaMock as unknown as PrismaService,
    eventEmitterMock as unknown as EventEmitter2,
  );
}

const slaEscalatedEvent = {
  ticketId: "ticket-1",
  branchId: "branch-1",
  targetType: "response" as const,
  targetAt: new Date("2026-01-01T00:30:00.000Z"),
};

const ticketRow = {
  id: "ticket-1",
  subject: "Cannot log in",
  category: "billing",
  priority: "MEDIUM",
  status: "OPEN",
  customerId: "customer-1",
  contactId: null,
  departmentId: null,
  assignedToUserId: null,
};

describe("TicketEscalationListener", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let eventEmitter: ReturnType<typeof buildEventEmitterMock>;
  let listener: TicketEscalationListener;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
    eventEmitter = buildEventEmitterMock();
    listener = createListener(prisma, eventEmitter);
  });

  describe("onSlaEscalated", () => {
    it("re-fetches the ticket by event.ticketId with the exact select shape", async () => {
      prisma.ticket.findUnique.mockResolvedValue(ticketRow);

      await listener.onSlaEscalated(slaEscalatedEvent);

      expect(prisma.ticket.findUnique).toHaveBeenCalledWith({
        where: { id: "ticket-1" },
        select: {
          id: true,
          subject: true,
          category: true,
          priority: true,
          status: true,
          customerId: true,
          contactId: true,
          departmentId: true,
          assignedToUserId: true,
        },
      });
    });

    it("emits ticket.escalated with the mapped TicketSummary and a null actorUserId", async () => {
      prisma.ticket.findUnique.mockResolvedValue(ticketRow);

      await listener.onSlaEscalated(slaEscalatedEvent);

      expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
      expect(eventEmitter.emit).toHaveBeenCalledWith(TICKET_ESCALATED_EVENT, {
        ticket: {
          id: "ticket-1",
          subject: "Cannot log in",
          category: "billing",
          priority: "MEDIUM",
          status: "OPEN",
          customerId: "customer-1",
          contactId: null,
          departmentId: null,
          assignedToUserId: null,
        },
        actorUserId: null,
      });
    });

    it("does nothing when the ticket cannot be found (defensive edge case)", async () => {
      prisma.ticket.findUnique.mockResolvedValue(null);

      await listener.onSlaEscalated(slaEscalatedEvent);

      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it("does not throw when the Prisma read fails — it catches and logs instead", async () => {
      prisma.ticket.findUnique.mockRejectedValue(new Error("db unavailable"));

      await expect(listener.onSlaEscalated(slaEscalatedEvent)).resolves.toBeUndefined();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  it("subscribes to sla.escalated", () => {
    // Sanity check that the constant this listener is decorated with matches
    // the constant SlaEscalationListener actually emits.
    expect(SLA_ESCALATED_EVENT).toBe("sla.escalated");
  });
});
