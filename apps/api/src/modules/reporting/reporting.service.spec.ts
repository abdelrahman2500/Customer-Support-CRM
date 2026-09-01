import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReportingService } from "./reporting.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { TenantContext } from "../../common/tenant/tenant-context";

function buildPrismaMock() {
  return {
    ticket: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    slaTicketTarget: {
      findMany: vi.fn(),
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

    // Story 93 — date-range filtering.
    it("omits createdAt entirely from the where clause when from/to are both omitted (byte-for-byte pre-Story-93 query)", async () => {
      prisma.ticket.groupBy.mockResolvedValue([]);

      await service.getTicketVolumeByStatus();

      expect(prisma.ticket.groupBy).toHaveBeenCalledWith({
        by: ["status"],
        where: { branchId: "branch-1" },
        _count: { _all: true },
      });
    });

    it("filters by Ticket.createdAt when a range is supplied", async () => {
      prisma.ticket.groupBy.mockResolvedValue([]);

      await service.getTicketVolumeByStatus("2026-01-01", "2026-01-31");

      expect(prisma.ticket.groupBy).toHaveBeenCalledWith({
        by: ["status"],
        where: {
          branchId: "branch-1",
          createdAt: { gte: new Date("2026-01-01T00:00:00.000Z"), lt: new Date("2026-02-01T00:00:00.000Z") },
        },
        _count: { _all: true },
      });
    });

    it("propagates a BadRequestException for an invalid range without ever querying Prisma", async () => {
      await expect(
        service.getTicketVolumeByStatus("2026-02-01", "2026-01-01"),
      ).rejects.toThrow(/from must not be after to/);
      expect(prisma.ticket.groupBy).not.toHaveBeenCalled();
    });
  });

  describe("getSlaCompliance", () => {
    it("returns a null complianceRate when no ticket has an SLA target yet", async () => {
      prisma.slaTicketTarget.findMany.mockResolvedValue([]);
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
      prisma.slaTicketTarget.findMany.mockResolvedValue([
        { ticketId: "ticket-1" },
        { ticketId: "ticket-2" },
        { ticketId: "ticket-3" },
        { ticketId: "ticket-4" },
        { ticketId: "ticket-5" },
        { ticketId: "ticket-6" },
        { ticketId: "ticket-7" },
        { ticketId: "ticket-8" },
        { ticketId: "ticket-9" },
        { ticketId: "ticket-10" },
      ]);
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

    // Story 93 — regression: proves the cohort-query rewrite below produces
    // the exact same logical result, for the exact same no-range scenario,
    // as the pre-Story-93 `count()`/independent-`findMany()` implementation
    // (see the "computes compliantCount/complianceRate..." test above —
    // this is the identical 10-targeted/2-breached scenario, asserted the
    // same way).
    it("REGRESSION: with no from/to, returns the same logical result as the pre-Story-93 implementation", async () => {
      prisma.slaTicketTarget.findMany.mockResolvedValue(
        Array.from({ length: 10 }, (_, i) => ({ ticketId: `ticket-${i + 1}` })),
      );
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

    it("scopes the target lookup by branch, then scopes the escalation lookup to that exact cohort's ticket ids plus branch/resolution", async () => {
      prisma.slaTicketTarget.findMany.mockResolvedValue([
        { ticketId: "ticket-1" },
        { ticketId: "ticket-2" },
      ]);
      prisma.slaEscalation.findMany.mockResolvedValue([]);

      await service.getSlaCompliance();

      expect(prisma.slaTicketTarget.findMany).toHaveBeenCalledWith({
        where: { ticket: { branchId: "branch-1" } },
        select: { ticketId: true },
      });
      expect(prisma.slaEscalation.findMany).toHaveBeenCalledWith({
        where: {
          branchId: "branch-1",
          targetType: "resolution",
          ticketId: { in: ["ticket-1", "ticket-2"] },
        },
        select: { ticketId: true },
        distinct: ["ticketId"],
      });
    });

    it("never queries slaEscalation at all when the cohort has no targeted tickets", async () => {
      prisma.slaTicketTarget.findMany.mockResolvedValue([]);

      await service.getSlaCompliance();

      expect(prisma.slaEscalation.findMany).not.toHaveBeenCalled();
    });

    it("never returns a negative compliantCount even if breachedCount somehow exceeds totalWithTarget (defense-in-depth — the cohort's own ticketId: {in: ...} filter already makes this unreachable in production, since prisma.slaEscalation.findMany is mocked here rather than truly filtered)", async () => {
      prisma.slaTicketTarget.findMany.mockResolvedValue([{ ticketId: "ticket-1" }]);
      prisma.slaEscalation.findMany.mockResolvedValue([
        { ticketId: "ticket-1" },
        { ticketId: "ticket-2" },
      ]);

      const result = await service.getSlaCompliance();

      expect(result.compliantCount).toBe(0);
    });

    // Story 93 — date-range filtering.
    it("filters the target cohort by SlaTicketTarget.createdAt, not SlaEscalation.escalatedAt, when a range is supplied", async () => {
      prisma.slaTicketTarget.findMany.mockResolvedValue([{ ticketId: "ticket-1" }]);
      prisma.slaEscalation.findMany.mockResolvedValue([]);

      await service.getSlaCompliance("2026-01-01", "2026-01-31");

      expect(prisma.slaTicketTarget.findMany).toHaveBeenCalledWith({
        where: {
          ticket: { branchId: "branch-1" },
          createdAt: { gte: new Date("2026-01-01T00:00:00.000Z"), lt: new Date("2026-02-01T00:00:00.000Z") },
        },
        select: { ticketId: true },
      });
      // The escalation lookup is never itself date-filtered — it stays
      // constrained to the cohort's ticketIds regardless of when the
      // breach was recorded (see this method's own doc comment).
      expect(prisma.slaEscalation.findMany).toHaveBeenCalledWith({
        where: { branchId: "branch-1", targetType: "resolution", ticketId: { in: ["ticket-1"] } },
        select: { ticketId: true },
        distinct: ["ticketId"],
      });
    });

    it("propagates a BadRequestException for an invalid range without ever querying Prisma", async () => {
      await expect(service.getSlaCompliance("2026-02-01", "2026-01-01")).rejects.toThrow(
        /from must not be after to/,
      );
      expect(prisma.slaTicketTarget.findMany).not.toHaveBeenCalled();
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

    // Story 93 — date-range filtering.
    it("filters by TicketCsatResponse.createdAt (submission time), not Ticket.createdAt, when a range is supplied", async () => {
      prisma.ticketCsatResponse.aggregate.mockResolvedValue({
        _avg: { rating: null },
        _count: { _all: 0 },
      });

      await service.getCsatSummary("2026-01-01", "2026-01-31");

      expect(prisma.ticketCsatResponse.aggregate).toHaveBeenCalledWith({
        where: {
          ticket: { branchId: "branch-1" },
          createdAt: { gte: new Date("2026-01-01T00:00:00.000Z"), lt: new Date("2026-02-01T00:00:00.000Z") },
        },
        _avg: { rating: true },
        _count: { _all: true },
      });
    });

    it("propagates a BadRequestException for an invalid range without ever querying Prisma", async () => {
      await expect(service.getCsatSummary("2026-02-01", "2026-01-01")).rejects.toThrow(
        /from must not be after to/,
      );
      expect(prisma.ticketCsatResponse.aggregate).not.toHaveBeenCalled();
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

    // Story 93 — date-range filtering.
    it("filters by Ticket.createdAt when a range is supplied (a cohort-outcome view, not a live-workload view)", async () => {
      prisma.ticket.groupBy.mockResolvedValue([]);

      await service.getAgentPerformance("2026-01-01", "2026-01-31");

      expect(prisma.ticket.groupBy).toHaveBeenCalledWith({
        by: ["assignedToUserId", "status"],
        where: {
          branchId: "branch-1",
          assignedToUserId: { not: null },
          createdAt: { gte: new Date("2026-01-01T00:00:00.000Z"), lt: new Date("2026-02-01T00:00:00.000Z") },
        },
        _count: { _all: true },
      });
    });

    it("propagates a BadRequestException for an invalid range without ever querying Prisma", async () => {
      await expect(service.getAgentPerformance("2026-02-01", "2026-01-01")).rejects.toThrow(
        /from must not be after to/,
      );
      expect(prisma.ticket.groupBy).not.toHaveBeenCalled();
    });
  });

  describe("getTicketAging", () => {
    const NOW = new Date("2026-01-08T00:00:00.000Z");

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(NOW);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    function daysBeforeNow(days: number): Date {
      return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
    }

    it("scopes the query to OPEN/IN_PROGRESS tickets in the caller's branch", async () => {
      prisma.ticket.findMany.mockResolvedValue([]);

      await service.getTicketAging();

      expect(prisma.ticket.findMany).toHaveBeenCalledWith({
        where: { branchId: "branch-1", status: { in: ["OPEN", "IN_PROGRESS"] } },
        select: { createdAt: true },
      });
    });

    it("returns all four buckets, zero-filled, when there are no open tickets", async () => {
      prisma.ticket.findMany.mockResolvedValue([]);

      const result = await service.getTicketAging();

      expect(result).toEqual([
        { bucket: "0-1d", count: 0 },
        { bucket: "1-3d", count: 0 },
        { bucket: "3-7d", count: 0 },
        { bucket: "7d+", count: 0 },
      ]);
    });

    it("buckets tickets by age, including right at each boundary", async () => {
      prisma.ticket.findMany.mockResolvedValue([
        { createdAt: daysBeforeNow(0.5) }, // 0-1d
        { createdAt: daysBeforeNow(1) }, // 1-3d (boundary: >= 1 day)
        { createdAt: daysBeforeNow(2.9) }, // 1-3d
        { createdAt: daysBeforeNow(3) }, // 3-7d (boundary: >= 3 days)
        { createdAt: daysBeforeNow(6.9) }, // 3-7d
        { createdAt: daysBeforeNow(7) }, // 7d+ (boundary: >= 7 days)
        { createdAt: daysBeforeNow(30) }, // 7d+
      ]);

      const result = await service.getTicketAging();

      expect(result).toEqual([
        { bucket: "0-1d", count: 1 },
        { bucket: "1-3d", count: 2 },
        { bucket: "3-7d", count: 2 },
        { bucket: "7d+", count: 2 },
      ]);
    });

    // Story 93 — date-range filtering.
    it("filters which tickets are included by Ticket.createdAt, but buckets age relative to the real current time, unchanged", async () => {
      prisma.ticket.findMany.mockResolvedValue([]);

      await service.getTicketAging("2026-01-01", "2026-01-05");

      expect(prisma.ticket.findMany).toHaveBeenCalledWith({
        where: {
          branchId: "branch-1",
          status: { in: ["OPEN", "IN_PROGRESS"] },
          createdAt: { gte: new Date("2026-01-01T00:00:00.000Z"), lt: new Date("2026-01-06T00:00:00.000Z") },
        },
        select: { createdAt: true },
      });
    });

    it("propagates a BadRequestException for an invalid range without ever querying Prisma", async () => {
      await expect(service.getTicketAging("2026-02-01", "2026-01-01")).rejects.toThrow(
        /from must not be after to/,
      );
      expect(prisma.ticket.findMany).not.toHaveBeenCalled();
    });
  });
});
