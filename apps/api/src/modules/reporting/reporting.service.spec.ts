import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReportingService } from "./reporting.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { TenantContext } from "../../common/tenant/tenant-context";

function buildPrismaMock() {
  return {
    ticket: {
      groupBy: vi.fn(),
    },
    slaTicketTarget: {
      count: vi.fn(),
    },
    slaEscalation: {
      findMany: vi.fn(),
    },
    ticketCsatResponse: {
      aggregate: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  };
}

function buildTenantContextMock(branchId: string | null = "branch-1") {
  return {
    requireBranchScope: vi.fn(() => {
      if (!branchId) {
        throw new Error("TenantContext: no active branch on this request");
      }
      return { branchId };
    }),
  };
}

function createService(
  prismaMock: ReturnType<typeof buildPrismaMock>,
  tenantMock: ReturnType<typeof buildTenantContextMock>,
): ReportingService {
  return new ReportingService(
    prismaMock as unknown as PrismaService,
    tenantMock as unknown as TenantContext,
  );
}

describe("ReportingService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let tenantContext: ReturnType<typeof buildTenantContextMock>;
  let service: ReportingService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    tenantContext = buildTenantContextMock();
    service = createService(prisma, tenantContext);
  });

  describe("getTicketVolumeByStatus", () => {
    it("scopes the query by branch and groups by status", async () => {
      prisma.ticket.groupBy.mockResolvedValue([]);

      await service.getTicketVolumeByStatus();

      expect(tenantContext.requireBranchScope).toHaveBeenCalledOnce();
      expect(prisma.ticket.groupBy).toHaveBeenCalledWith({
        by: ["status"],
        where: { branchId: "branch-1" },
        _count: { _all: true },
      });
    });

    it("maps grouped rows to {status, count}", async () => {
      prisma.ticket.groupBy.mockResolvedValue([
        { status: "OPEN", _count: { _all: 3 } },
        { status: "RESOLVED", _count: { _all: 5 } },
      ]);

      const result = await service.getTicketVolumeByStatus();

      expect(result).toEqual([
        { status: "OPEN", count: 3 },
        { status: "RESOLVED", count: 5 },
      ]);
    });

    it("returns [] when the branch has no tickets", async () => {
      prisma.ticket.groupBy.mockResolvedValue([]);

      const result = await service.getTicketVolumeByStatus();

      expect(result).toEqual([]);
    });

    it("propagates TenantContext's error when there is no active branch", async () => {
      tenantContext = buildTenantContextMock(null);
      service = createService(prisma, tenantContext);

      await expect(service.getTicketVolumeByStatus()).rejects.toThrow(/no active branch/);
    });
  });

  describe("getSlaCompliance", () => {
    it("returns a null complianceRate when no ticket has an SLA target yet", async () => {
      prisma.slaTicketTarget.count.mockResolvedValue(0);
      prisma.slaEscalation.findMany.mockResolvedValue([]);

      const result = await service.getSlaCompliance();

      expect(result).toEqual({
        totalWithTarget: 0,
        breachedCount: 0,
        compliantCount: 0,
        complianceRate: null,
      });
    });

    it("computes compliantCount/complianceRate from targeted vs. breached tickets", async () => {
      prisma.slaTicketTarget.count.mockResolvedValue(10);
      prisma.slaEscalation.findMany.mockResolvedValue([
        { ticketId: "ticket-1" },
        { ticketId: "ticket-2" },
      ]);

      const result = await service.getSlaCompliance();

      expect(result).toEqual({
        totalWithTarget: 10,
        breachedCount: 2,
        compliantCount: 8,
        complianceRate: 0.8,
      });
    });

    it("scopes both queries by branch and filters escalations to resolution breaches only", async () => {
      prisma.slaTicketTarget.count.mockResolvedValue(0);
      prisma.slaEscalation.findMany.mockResolvedValue([]);

      await service.getSlaCompliance();

      expect(prisma.slaTicketTarget.count).toHaveBeenCalledWith({
        where: { ticket: { branchId: "branch-1" } },
      });
      expect(prisma.slaEscalation.findMany).toHaveBeenCalledWith({
        where: { branchId: "branch-1", targetType: "resolution" },
        select: { ticketId: true },
        distinct: ["ticketId"],
      });
    });

    it("never returns a negative compliantCount even if breachedCount somehow exceeds totalWithTarget", async () => {
      prisma.slaTicketTarget.count.mockResolvedValue(1);
      prisma.slaEscalation.findMany.mockResolvedValue([
        { ticketId: "ticket-1" },
        { ticketId: "ticket-2" },
      ]);

      const result = await service.getSlaCompliance();

      expect(result.compliantCount).toBe(0);
    });
  });

  describe("getCsatSummary", () => {
    it("returns a null averageRating when there is no feedback yet", async () => {
      prisma.ticketCsatResponse.aggregate.mockResolvedValue({
        _avg: { rating: null },
        _count: { _all: 0 },
      });

      const result = await service.getCsatSummary();

      expect(result).toEqual({ responseCount: 0, averageRating: null });
    });

    it("maps a populated aggregate", async () => {
      prisma.ticketCsatResponse.aggregate.mockResolvedValue({
        _avg: { rating: 4.5 },
        _count: { _all: 2 },
      });

      const result = await service.getCsatSummary();

      expect(result).toEqual({ responseCount: 2, averageRating: 4.5 });
    });

    it("scopes through the Ticket relation by branch", async () => {
      prisma.ticketCsatResponse.aggregate.mockResolvedValue({
        _avg: { rating: null },
        _count: { _all: 0 },
      });

      await service.getCsatSummary();

      expect(prisma.ticketCsatResponse.aggregate).toHaveBeenCalledWith({
        where: { ticket: { branchId: "branch-1" } },
        _avg: { rating: true },
        _count: { _all: true },
      });
    });
  });

  describe("getAgentPerformance", () => {
    it("scopes the groupBy query by branch and excludes unassigned tickets", async () => {
      prisma.ticket.groupBy.mockResolvedValue([]);

      await service.getAgentPerformance();

      expect(prisma.ticket.groupBy).toHaveBeenCalledWith({
        by: ["assignedToUserId", "status"],
        where: { branchId: "branch-1", assignedToUserId: { not: null } },
        _count: { _all: true },
      });
    });

    it("returns [] and skips the user lookup when no ticket is assigned to anyone", async () => {
      prisma.ticket.groupBy.mockResolvedValue([]);

      const result = await service.getAgentPerformance();

      expect(result).toEqual([]);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it("buckets OPEN/IN_PROGRESS into openCount and RESOLVED/CLOSED into resolvedCount, per agent", async () => {
      prisma.ticket.groupBy.mockResolvedValue([
        { assignedToUserId: "user-1", status: "OPEN", _count: { _all: 2 } },
        { assignedToUserId: "user-1", status: "IN_PROGRESS", _count: { _all: 1 } },
        { assignedToUserId: "user-1", status: "RESOLVED", _count: { _all: 3 } },
        { assignedToUserId: "user-2", status: "CLOSED", _count: { _all: 5 } },
      ]);
      prisma.user.findMany.mockResolvedValue([
        { id: "user-1", fullName: "Bob Agent" },
        { id: "user-2", fullName: "Alice Agent" },
      ]);

      const result = await service.getAgentPerformance();

      expect(result).toEqual([
        { userId: "user-2", fullName: "Alice Agent", openCount: 0, resolvedCount: 5 },
        { userId: "user-1", fullName: "Bob Agent", openCount: 3, resolvedCount: 3 },
      ]);
    });

    it("looks up only the distinct assigned user ids", async () => {
      prisma.ticket.groupBy.mockResolvedValue([
        { assignedToUserId: "user-1", status: "OPEN", _count: { _all: 1 } },
        { assignedToUserId: "user-1", status: "RESOLVED", _count: { _all: 1 } },
      ]);
      prisma.user.findMany.mockResolvedValue([{ id: "user-1", fullName: "Bob Agent" }]);

      await service.getAgentPerformance();

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { id: { in: ["user-1"] } },
        select: { id: true, fullName: true },
      });
    });

    it("falls back to the raw user id when the user can't be resolved", async () => {
      prisma.ticket.groupBy.mockResolvedValue([
        { assignedToUserId: "user-unknown", status: "OPEN", _count: { _all: 1 } },
      ]);
      prisma.user.findMany.mockResolvedValue([]);

      const result = await service.getAgentPerformance();

      expect(result).toEqual([
        { userId: "user-unknown", fullName: "user-unknown", openCount: 1, resolvedCount: 0 },
      ]);
    });
  });
});
