import { beforeEach, describe, expect, it, vi } from "vitest";
import { SlaTargetListener } from "./sla-target.listener";
import { TICKET_CREATED_EVENT } from "../tickets/tickets.events";
import type { TicketSummary } from "../tickets/tickets.service";
import type { PrismaService } from "../../prisma/prisma.service";

function buildPrismaMock() {
  return {
    ticket: {
      findUnique: vi.fn(),
    },
    slaPolicy: {
      findMany: vi.fn(),
    },
    slaTicketTarget: {
      create: vi.fn(),
    },
  };
}

function createListener(prismaMock: ReturnType<typeof buildPrismaMock>): SlaTargetListener {
  return new SlaTargetListener(prismaMock as unknown as PrismaService);
}

const ticket: TicketSummary = {
  id: "ticket-1",
  subject: "Cannot log in",
  category: null,
  priority: "MEDIUM",
  status: "OPEN",
  customerId: "customer-1",
  contactId: null,
  departmentId: null,
  assignedToUserId: null,
};

const fullTicketRow = {
  branchId: "branch-1",
  departmentId: null as string | null,
  category: null as string | null,
  priority: "MEDIUM",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

function wildcardPolicy(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "policy-wildcard",
    departmentId: null,
    category: null,
    priority: null,
    responseTargetMinutes: 30,
    resolutionTargetMinutes: 240,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("SlaTargetListener", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let listener: SlaTargetListener;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
    listener = createListener(prisma);
  });

  describe("onTicketCreated", () => {
    it("re-fetches the ticket by event.ticket.id", async () => {
      prisma.ticket.findUnique.mockResolvedValue(fullTicketRow);
      prisma.slaPolicy.findMany.mockResolvedValue([]);

      await listener.onTicketCreated({ ticket, actorUserId: "user-1" });

      expect(prisma.ticket.findUnique).toHaveBeenCalledWith({
        where: { id: "ticket-1" },
        select: {
          branchId: true,
          departmentId: true,
          category: true,
          priority: true,
          createdAt: true,
        },
      });
    });

    it("does nothing when the ticket cannot be re-fetched (defensive edge case)", async () => {
      prisma.ticket.findUnique.mockResolvedValue(null);

      await listener.onTicketCreated({ ticket, actorUserId: "user-1" });

      expect(prisma.slaPolicy.findMany).not.toHaveBeenCalled();
      expect(prisma.slaTicketTarget.create).not.toHaveBeenCalled();
    });

    it("creates no target when no active policy matches", async () => {
      prisma.ticket.findUnique.mockResolvedValue(fullTicketRow);
      prisma.slaPolicy.findMany.mockResolvedValue([]);

      await listener.onTicketCreated({ ticket, actorUserId: "user-1" });

      expect(prisma.slaTicketTarget.create).not.toHaveBeenCalled();
    });

    it("creates a target computed from the ticket's createdAt plus the matched policy's minute counts", async () => {
      prisma.ticket.findUnique.mockResolvedValue(fullTicketRow);
      prisma.slaPolicy.findMany.mockResolvedValue([wildcardPolicy()]);

      await listener.onTicketCreated({ ticket, actorUserId: "user-1" });

      expect(prisma.slaTicketTarget.create).toHaveBeenCalledWith({
        data: {
          ticketId: "ticket-1",
          slaPolicyId: "policy-wildcard",
          responseTargetAt: new Date("2026-01-01T00:30:00.000Z"),
          resolutionTargetAt: new Date("2026-01-01T04:00:00.000Z"),
        },
      });
    });

    it("prefers the more specific of two matching candidates", async () => {
      prisma.ticket.findUnique.mockResolvedValue({ ...fullTicketRow, category: "billing" });
      const wildcard = wildcardPolicy({
        id: "policy-wildcard",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });
      const scoped = wildcardPolicy({
        id: "policy-scoped",
        category: "billing",
        responseTargetMinutes: 15,
        resolutionTargetMinutes: 120,
        createdAt: new Date("2026-01-01T00:05:00.000Z"),
      });
      prisma.slaPolicy.findMany.mockResolvedValue([wildcard, scoped]);

      await listener.onTicketCreated({ ticket, actorUserId: "user-1" });

      expect(prisma.slaTicketTarget.create).toHaveBeenCalledWith({
        data: {
          ticketId: "ticket-1",
          slaPolicyId: "policy-scoped",
          responseTargetAt: new Date("2026-01-01T00:15:00.000Z"),
          resolutionTargetAt: new Date("2026-01-01T02:00:00.000Z"),
        },
      });
    });

    it("breaks ties between equally-specific candidates by earliest createdAt", async () => {
      prisma.ticket.findUnique.mockResolvedValue(fullTicketRow);
      const earlier = wildcardPolicy({
        id: "policy-earlier",
        responseTargetMinutes: 10,
        resolutionTargetMinutes: 100,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });
      const later = wildcardPolicy({
        id: "policy-later",
        responseTargetMinutes: 999,
        resolutionTargetMinutes: 999,
        createdAt: new Date("2026-01-01T01:00:00.000Z"),
      });
      // Simulate the service's own `orderBy: { createdAt: "asc" }` ordering.
      prisma.slaPolicy.findMany.mockResolvedValue([earlier, later]);

      await listener.onTicketCreated({ ticket, actorUserId: "user-1" });

      expect(prisma.slaTicketTarget.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ slaPolicyId: "policy-earlier" }) }),
      );
    });

    it("does not throw when persistence fails — it catches and logs instead", async () => {
      prisma.ticket.findUnique.mockResolvedValue(fullTicketRow);
      prisma.slaPolicy.findMany.mockResolvedValue([wildcardPolicy()]);
      prisma.slaTicketTarget.create.mockRejectedValue(new Error("db unavailable"));

      await expect(
        listener.onTicketCreated({ ticket, actorUserId: "user-1" }),
      ).resolves.toBeUndefined();
    });
  });

  it("does not subscribe to ticket.updated", () => {
    expect((listener as unknown as Record<string, unknown>).onTicketUpdated).toBeUndefined();
  });

  it("subscribes to ticket.created", () => {
    // Sanity check that the constant this listener is decorated with matches
    // the constant TicketsService actually emits.
    expect(TICKET_CREATED_EVENT).toBe("ticket.created");
  });
});
