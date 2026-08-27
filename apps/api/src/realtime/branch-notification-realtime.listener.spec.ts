import { beforeEach, describe, expect, it, vi } from "vitest";
import { BranchNotificationRealtimeListener } from "./branch-notification-realtime.listener";
import { SLA_AT_RISK_EVENT, SLA_BREACHED_EVENT } from "../modules/sla-policies/sla-detection.events";
import { TICKET_ESCALATED_EVENT } from "../modules/tickets/tickets.events";
import type { RealtimeGateway } from "./realtime.gateway";
import type { PrismaService } from "../prisma/prisma.service";

function buildGatewayMock() {
  const emit = vi.fn();
  const to = vi.fn().mockReturnValue({ emit });
  return { server: { to }, _emit: emit, _to: to };
}

function buildPrismaMock() {
  return { ticket: { findUnique: vi.fn() } };
}

function createListener(
  gatewayMock: ReturnType<typeof buildGatewayMock>,
  prismaMock: ReturnType<typeof buildPrismaMock>,
): BranchNotificationRealtimeListener {
  return new BranchNotificationRealtimeListener(
    gatewayMock as unknown as RealtimeGateway,
    prismaMock as unknown as PrismaService,
  );
}

const atRiskEvent = {
  ticketId: "ticket-1",
  branchId: "branch-1",
  targetType: "response" as const,
  targetAt: new Date("2026-01-01T00:24:00.000Z"),
};

const breachedEvent = {
  ticketId: "ticket-2",
  branchId: "branch-2",
  targetType: "resolution" as const,
  targetAt: new Date("2026-01-01T00:30:00.000Z"),
};

const ticketSummary = {
  id: "ticket-3",
  subject: "Cannot log in",
  category: "billing",
  priority: "MEDIUM" as const,
  status: "OPEN" as const,
  customerId: "customer-1",
  contactId: null,
  departmentId: null,
  assignedToUserId: null,
};

const escalatedEvent = { ticket: ticketSummary, actorUserId: null };

describe("BranchNotificationRealtimeListener", () => {
  let gateway: ReturnType<typeof buildGatewayMock>;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let listener: BranchNotificationRealtimeListener;

  beforeEach(() => {
    vi.clearAllMocks();
    gateway = buildGatewayMock();
    prisma = buildPrismaMock();
    listener = createListener(gateway, prisma);
  });

  it("relays sla.at_risk into branch:{branchId}:notifications with the unmodified event payload", () => {
    listener.onSlaAtRisk(atRiskEvent);

    expect(gateway._to).toHaveBeenCalledWith("branch:branch-1:notifications");
    expect(gateway._emit).toHaveBeenCalledWith(SLA_AT_RISK_EVENT, atRiskEvent);
  });

  it("relays sla.breached into branch:{branchId}:notifications with the unmodified event payload", () => {
    listener.onSlaBreached(breachedEvent);

    expect(gateway._to).toHaveBeenCalledWith("branch:branch-2:notifications");
    expect(gateway._emit).toHaveBeenCalledWith(SLA_BREACHED_EVENT, breachedEvent);
  });

  describe("onTicketEscalated", () => {
    it("resolves the ticket's branch and relays into branch:{resolvedBranchId}:notifications", async () => {
      prisma.ticket.findUnique.mockResolvedValue({ branchId: "branch-3" });

      await listener.onTicketEscalated(escalatedEvent);

      expect(prisma.ticket.findUnique).toHaveBeenCalledWith({
        where: { id: "ticket-3" },
        select: { branchId: true },
      });
      expect(gateway._to).toHaveBeenCalledWith("branch:branch-3:notifications");
      expect(gateway._emit).toHaveBeenCalledWith(TICKET_ESCALATED_EVENT, escalatedEvent);
    });

    it("does not relay when the ticket cannot be found", async () => {
      prisma.ticket.findUnique.mockResolvedValue(null);

      await listener.onTicketEscalated(escalatedEvent);

      expect(gateway._to).not.toHaveBeenCalled();
    });

    it("does not throw when the Prisma lookup fails — it catches and logs instead", async () => {
      prisma.ticket.findUnique.mockRejectedValue(new Error("db unavailable"));

      await expect(listener.onTicketEscalated(escalatedEvent)).resolves.toBeUndefined();
      expect(gateway._to).not.toHaveBeenCalled();
    });
  });

  it("does not throw when server.to(...).emit(...) throws for sla.at_risk — catches and logs instead", () => {
    gateway._to.mockImplementation(() => {
      throw new Error("socket server unavailable");
    });

    expect(() => listener.onSlaAtRisk(atRiskEvent)).not.toThrow();
  });

  it("does not throw when server.to(...).emit(...) throws for sla.breached — catches and logs instead", () => {
    gateway._to.mockImplementation(() => {
      throw new Error("socket server unavailable");
    });

    expect(() => listener.onSlaBreached(breachedEvent)).not.toThrow();
  });
});
