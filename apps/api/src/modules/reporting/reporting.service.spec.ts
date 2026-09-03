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
    aiPromptLog: {
      groupBy: vi.fn(),
      count: vi.fn(),
    },
    ticketCategory: {
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

  describe("getTicketVolumeByCategory", () => {
    it("scopes the groupBy query by branch and groups by categoryId, without excluding null", async () => {
      prisma.ticket.groupBy.mockResolvedValue([]);

      await service.getTicketVolumeByCategory();

      expect(prisma.ticket.groupBy).toHaveBeenCalledWith({
        by: ["categoryId"],
        where: { branchId: "branch-1" },
        _count: { _all: true },
      });
    });

    it("returns [] and skips the category lookup when the branch has no tickets", async () => {
      prisma.ticket.groupBy.mockResolvedValue([]);

      const result = await service.getTicketVolumeByCategory();

      expect(result).toEqual([]);
      expect(prisma.ticketCategory.findMany).not.toHaveBeenCalled();
    });

    it("looks up only the distinct, non-null category ids", async () => {
      prisma.ticket.groupBy.mockResolvedValue([
        { categoryId: "category-1", _count: { _all: 2 } },
        { categoryId: null, _count: { _all: 1 } },
      ]);
      prisma.ticketCategory.findMany.mockResolvedValue([
        { id: "category-1", name: "Billing" },
      ]);

      await service.getTicketVolumeByCategory();

      expect(prisma.ticketCategory.findMany).toHaveBeenCalledWith({
        where: { id: { in: ["category-1"] } },
        select: { id: true, name: true },
      });
    });

    it("maps grouped rows to {categoryId, categoryName, count}, sorted by name with the null (Uncategorized) row last", async () => {
      prisma.ticket.groupBy.mockResolvedValue([
        { categoryId: "category-2", _count: { _all: 4 } },
        { categoryId: null, _count: { _all: 7 } },
        { categoryId: "category-1", _count: { _all: 2 } },
      ]);
      prisma.ticketCategory.findMany.mockResolvedValue([
        { id: "category-1", name: "Billing" },
        { id: "category-2", name: "Technical" },
      ]);

      const result = await service.getTicketVolumeByCategory();

      expect(result).toEqual([
        { categoryId: "category-1", categoryName: "Billing", count: 2 },
        { categoryId: "category-2", categoryName: "Technical", count: 4 },
        { categoryId: null, categoryName: null, count: 7 },
      ]);
    });

    it("falls back to the raw category id when the category can't be resolved", async () => {
      prisma.ticket.groupBy.mockResolvedValue([
        { categoryId: "category-unknown", _count: { _all: 1 } },
      ]);
      prisma.ticketCategory.findMany.mockResolvedValue([]);

      const result = await service.getTicketVolumeByCategory();

      expect(result).toEqual([
        { categoryId: "category-unknown", categoryName: "category-unknown", count: 1 },
      ]);
    });

    // Story 93-style date-range filtering, same convention as every other method here.
    it("filters by Ticket.createdAt when a range is supplied", async () => {
      prisma.ticket.groupBy.mockResolvedValue([]);

      await service.getTicketVolumeByCategory("2026-01-01", "2026-01-31");

      expect(prisma.ticket.groupBy).toHaveBeenCalledWith({
        by: ["categoryId"],
        where: {
          branchId: "branch-1",
          createdAt: { gte: new Date("2026-01-01T00:00:00.000Z"), lt: new Date("2026-02-01T00:00:00.000Z") },
        },
        _count: { _all: true },
      });
    });

    it("propagates a BadRequestException for an invalid range without ever querying Prisma", async () => {
      await expect(
        service.getTicketVolumeByCategory("2026-02-01", "2026-01-01"),
      ).rejects.toThrow(/from must not be after to/);
      expect(prisma.ticket.groupBy).not.toHaveBeenCalled();
    });

    it("propagates TenantContext's error when there is no active branch", async () => {
      tenantContext = buildTenantContextMock(null);
      service = createService(prisma, tenantContext);

      await expect(service.getTicketVolumeByCategory()).rejects.toThrow(/no active branch/);
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

  // Story 99 — Ticket Resolution-Time Metrics.
  describe("getResolutionTime", () => {
    it("returns a null averageResolutionMs when no ticket has ever resolved yet", async () => {
      prisma.ticket.findMany.mockResolvedValue([]);

      const result = await service.getResolutionTime();

      expect(result).toEqual({ resolvedCount: 0, averageResolutionMs: null });
    });

    it("computes the average resolution duration across resolved tickets", async () => {
      prisma.ticket.findMany.mockResolvedValue([
        { createdAt: new Date("2026-01-01T00:00:00.000Z"), resolvedAt: new Date("2026-01-01T02:00:00.000Z") }, // 2h
        { createdAt: new Date("2026-01-01T00:00:00.000Z"), resolvedAt: new Date("2026-01-01T04:00:00.000Z") }, // 4h
      ]);

      const result = await service.getResolutionTime();

      expect(result).toEqual({ resolvedCount: 2, averageResolutionMs: 3 * 60 * 60 * 1000 });
    });

    it("scopes the query by branch and excludes unresolved tickets", async () => {
      prisma.ticket.findMany.mockResolvedValue([]);

      await service.getResolutionTime();

      expect(prisma.ticket.findMany).toHaveBeenCalledWith({
        where: { branchId: "branch-1", resolvedAt: { not: null } },
        select: { createdAt: true, resolvedAt: true },
      });
    });

    it("filters by Ticket.resolvedAt (not createdAt) when a range is supplied", async () => {
      prisma.ticket.findMany.mockResolvedValue([]);

      await service.getResolutionTime("2026-01-01", "2026-01-31");

      expect(prisma.ticket.findMany).toHaveBeenCalledWith({
        where: {
          branchId: "branch-1",
          resolvedAt: {
            not: null,
            gte: new Date("2026-01-01T00:00:00.000Z"),
            lt: new Date("2026-02-01T00:00:00.000Z"),
          },
        },
        select: { createdAt: true, resolvedAt: true },
      });
    });

    it("propagates a BadRequestException for an invalid range without ever querying Prisma", async () => {
      await expect(service.getResolutionTime("2026-02-01", "2026-01-01")).rejects.toThrow(
        /from must not be after to/,
      );
      expect(prisma.ticket.findMany).not.toHaveBeenCalled();
    });

    it("propagates TenantContext's error when there is no active branch", async () => {
      tenantContext = buildTenantContextMock(null);
      service = createService(prisma, tenantContext);

      await expect(service.getResolutionTime()).rejects.toThrow(/no active branch/);
    });
  });

  // Story 121 — AI Usage/Cost Reporting.
  describe("getAiUsage", () => {
    it("returns all-zero/null totals and [] byFeature when the branch has no AiPromptLog rows", async () => {
      prisma.aiPromptLog.groupBy.mockResolvedValue([]);
      prisma.aiPromptLog.count.mockResolvedValue(0);

      const result = await service.getAiUsage();

      expect(result).toEqual({
        totalCalls: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCostUsd: null,
        unpricedCallCount: 0,
        byFeature: [],
      });
    });

    it("scopes the query by branch and groups by [feature, outcome]", async () => {
      prisma.aiPromptLog.groupBy.mockResolvedValue([]);
      prisma.aiPromptLog.count.mockResolvedValue(0);

      await service.getAiUsage();

      expect(tenantContext.requireBranchScope).toHaveBeenCalledOnce();
      expect(prisma.aiPromptLog.groupBy).toHaveBeenCalledWith({
        by: ["feature", "outcome"],
        where: { branchId: "branch-1" },
        _count: { _all: true },
        _sum: { inputTokens: true, outputTokens: true, costMicroUsd: true },
      });
      expect(prisma.aiPromptLog.count).toHaveBeenCalledWith({
        where: { branchId: "branch-1", outcome: "SUCCESS", costMicroUsd: null },
      });
    });

    it("merges multiple outcome rows for the same feature into one byFeature entry", async () => {
      prisma.aiPromptLog.groupBy.mockResolvedValue([
        {
          feature: "SUMMARIZE",
          outcome: "SUCCESS",
          _count: { _all: 3 },
          _sum: { inputTokens: 300, outputTokens: 150, costMicroUsd: 9000 },
        },
        {
          feature: "SUMMARIZE",
          outcome: "ERROR",
          _count: { _all: 1 },
          _sum: { inputTokens: null, outputTokens: null, costMicroUsd: null },
        },
        {
          feature: "SUMMARIZE",
          outcome: "PENDING",
          _count: { _all: 1 },
          _sum: { inputTokens: null, outputTokens: null, costMicroUsd: null },
        },
      ]);
      prisma.aiPromptLog.count.mockResolvedValue(0);

      const result = await service.getAiUsage();

      expect(result.byFeature).toEqual([
        {
          feature: "SUMMARIZE",
          callCount: 5,
          successCount: 3,
          errorCount: 1,
          totalInputTokens: 300,
          totalOutputTokens: 150,
          totalCostUsd: 0.009,
        },
      ]);
      expect(result.totalCalls).toBe(5);
      expect(result.totalCostUsd).toBe(0.009);
    });

    it("keeps totalCostUsd null for a feature whose only successful calls are all unpriced", async () => {
      prisma.aiPromptLog.groupBy.mockResolvedValue([
        {
          feature: "CHAT",
          outcome: "SUCCESS",
          _count: { _all: 2 },
          _sum: { inputTokens: 400, outputTokens: 200, costMicroUsd: null },
        },
      ]);
      prisma.aiPromptLog.count.mockResolvedValue(2);

      const result = await service.getAiUsage();

      expect(result.byFeature).toEqual([
        {
          feature: "CHAT",
          callCount: 2,
          successCount: 2,
          errorCount: 0,
          totalInputTokens: 400,
          totalOutputTokens: 200,
          totalCostUsd: null,
        },
      ]);
      expect(result.totalCostUsd).toBeNull();
      expect(result.unpricedCallCount).toBe(2);
    });

    it("sums totalCostUsd across features, treating an unpriced feature as contributing $0, not null", async () => {
      prisma.aiPromptLog.groupBy.mockResolvedValue([
        {
          feature: "SUMMARIZE",
          outcome: "SUCCESS",
          _count: { _all: 1 },
          _sum: { inputTokens: 100, outputTokens: 50, costMicroUsd: 1_000_000 },
        },
        {
          feature: "CATEGORIZE",
          outcome: "SUCCESS",
          _count: { _all: 1 },
          _sum: { inputTokens: 100, outputTokens: 50, costMicroUsd: null },
        },
      ]);
      prisma.aiPromptLog.count.mockResolvedValue(1);

      const result = await service.getAiUsage();

      // $1 from the priced SUMMARIZE feature; CATEGORIZE contributes
      // nothing to the sum (unpriced), but the overall total is still a
      // real number, not null, because at least one feature is priced.
      expect(result.totalCostUsd).toBe(1);
      expect(result.unpricedCallCount).toBe(1);
    });

    it("sorts byFeature alphabetically by feature name", async () => {
      prisma.aiPromptLog.groupBy.mockResolvedValue([
        { feature: "SUGGEST_REPLY", outcome: "SUCCESS", _count: { _all: 1 }, _sum: { inputTokens: 1, outputTokens: 1, costMicroUsd: null } },
        { feature: "CATEGORIZE", outcome: "SUCCESS", _count: { _all: 1 }, _sum: { inputTokens: 1, outputTokens: 1, costMicroUsd: null } },
        { feature: "CHAT", outcome: "SUCCESS", _count: { _all: 1 }, _sum: { inputTokens: 1, outputTokens: 1, costMicroUsd: null } },
      ]);
      prisma.aiPromptLog.count.mockResolvedValue(3);

      const result = await service.getAiUsage();

      expect(result.byFeature.map((row) => row.feature)).toEqual([
        "CATEGORIZE",
        "CHAT",
        "SUGGEST_REPLY",
      ]);
    });

    it("filters by AiPromptLog.createdAt when a range is supplied", async () => {
      prisma.aiPromptLog.groupBy.mockResolvedValue([]);
      prisma.aiPromptLog.count.mockResolvedValue(0);

      await service.getAiUsage("2026-01-01", "2026-01-31");

      const expectedRange = {
        gte: new Date("2026-01-01T00:00:00.000Z"),
        lt: new Date("2026-02-01T00:00:00.000Z"),
      };
      expect(prisma.aiPromptLog.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({ where: { branchId: "branch-1", createdAt: expectedRange } }),
      );
      expect(prisma.aiPromptLog.count).toHaveBeenCalledWith({
        where: {
          branchId: "branch-1",
          outcome: "SUCCESS",
          costMicroUsd: null,
          createdAt: expectedRange,
        },
      });
    });

    it("propagates a BadRequestException for an invalid range without ever querying Prisma", async () => {
      await expect(service.getAiUsage("2026-02-01", "2026-01-01")).rejects.toThrow(
        /from must not be after to/,
      );
      expect(prisma.aiPromptLog.groupBy).not.toHaveBeenCalled();
    });

    it("propagates TenantContext's error when there is no active branch", async () => {
      tenantContext = buildTenantContextMock(null);
      service = createService(prisma, tenantContext);

      await expect(service.getAiUsage()).rejects.toThrow(/no active branch/);
    });
  });
});
