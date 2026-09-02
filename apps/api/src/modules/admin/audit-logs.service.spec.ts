import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuditLogsService } from "./audit-logs.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { TenantContext } from "../../common/tenant/tenant-context";

function buildPrismaMock() {
  return {
    auditLog: {
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
): AuditLogsService {
  return new AuditLogsService(
    prismaMock as unknown as PrismaService,
    tenantMock as unknown as TenantContext,
  );
}

describe("AuditLogsService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let tenantContext: ReturnType<typeof buildTenantContextMock>;
  let service: AuditLogsService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    tenantContext = buildTenantContextMock();
    service = createService(prisma, tenantContext);
  });

  describe("listAuditLogs", () => {
    it("scopes the query to the caller's branch plus branch-less (null) rows", async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);

      await service.listAuditLogs();

      expect(tenantContext.requireBranchScope).toHaveBeenCalledOnce();
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { OR: [{ branchId: "branch-1" }, { branchId: null }] },
        }),
      );
    });

    it("orders by createdAt descending (newest first)", async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);

      await service.listAuditLogs();

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: "desc" } }),
      );
    });

    it("returns an empty array when the branch has no audit log rows", async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);

      const result = await service.listAuditLogs();

      expect(result).toEqual([]);
    });

    it("maps a populated row exactly", async () => {
      const createdAt = new Date("2026-06-01T12:00:00.000Z");
      prisma.auditLog.findMany.mockResolvedValue([
        {
          id: "log-1",
          actorId: "user-1",
          action: "PATCH /api/v1/tickets/ticket-1",
          entityType: "http_request",
          entityId: null,
          branchId: "branch-1",
          diff: null,
          ipAddress: "127.0.0.1",
          createdAt,
        },
      ]);

      const result = await service.listAuditLogs();

      expect(result).toEqual([
        {
          id: "log-1",
          actorId: "user-1",
          action: "PATCH /api/v1/tickets/ticket-1",
          entityType: "http_request",
          entityId: null,
          branchId: "branch-1",
          diff: null,
          ipAddress: "127.0.0.1",
          createdAt,
        },
      ]);
    });

    it("maps a branch-less (null branchId) row exactly, e.g. a failed-login event", async () => {
      const createdAt = new Date("2026-06-01T12:00:00.000Z");
      prisma.auditLog.findMany.mockResolvedValue([
        {
          id: "log-2",
          actorId: null,
          action: "auth.login_failed",
          entityType: "user",
          entityId: "unknown@example.com",
          branchId: null,
          diff: null,
          ipAddress: "127.0.0.1",
          createdAt,
        },
      ]);

      const result = await service.listAuditLogs();

      expect(result).toEqual([
        {
          id: "log-2",
          actorId: null,
          action: "auth.login_failed",
          entityType: "user",
          entityId: "unknown@example.com",
          branchId: null,
          diff: null,
          ipAddress: "127.0.0.1",
          createdAt,
        },
      ]);
    });

    it("propagates TenantContext's error when there is no active branch", async () => {
      tenantContext = buildTenantContextMock(null);
      service = createService(prisma, tenantContext);

      await expect(service.listAuditLogs()).rejects.toThrow(/no active branch/);
    });

    // Story 104 — Audit Log Search, Filtering & a Bounded Result Cap.
    it("caps every query at 200 rows, unconditionally", async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);

      await service.listAuditLogs();

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 200 }),
      );
    });

    it("omitting every filter reproduces the exact pre-Story-104 where clause", async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);

      await service.listAuditLogs({});

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { OR: [{ branchId: "branch-1" }, { branchId: null }] },
        }),
      );
    });

    it("filters by action, ANDed with the existing branch/null scope", async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);

      await service.listAuditLogs({ action: "role.updated" });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { OR: [{ branchId: "branch-1" }, { branchId: null }] },
              { action: "role.updated" },
            ],
          },
        }),
      );
    });

    it("filters by entityType", async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);

      await service.listAuditLogs({ entityType: "role" });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { OR: [{ branchId: "branch-1" }, { branchId: null }] },
              { entityType: "role" },
            ],
          },
        }),
      );
    });

    it("filters by actorId", async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);

      await service.listAuditLogs({ actorId: "user-1" });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { OR: [{ branchId: "branch-1" }, { branchId: null }] },
              { actorId: "user-1" },
            ],
          },
        }),
      );
    });

    it("filters by date range, reusing resolveReportDateRange's own [gte, lt) semantics", async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);

      await service.listAuditLogs({ from: "2026-06-01", to: "2026-06-01" });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { OR: [{ branchId: "branch-1" }, { branchId: null }] },
              {
                createdAt: {
                  gte: new Date("2026-06-01T00:00:00.000Z"),
                  lt: new Date("2026-06-02T00:00:00.000Z"),
                },
              },
            ],
          },
        }),
      );
    });

    it("rejects an invalid date range (from after to)", async () => {
      await expect(
        service.listAuditLogs({ from: "2026-06-05", to: "2026-06-01" }),
      ).rejects.toThrow(/from must not be after to/);
    });

    it("combines multiple filters, all ANDed with the branch/null scope", async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);

      await service.listAuditLogs({ action: "role.updated", entityType: "role" });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { OR: [{ branchId: "branch-1" }, { branchId: null }] },
              { action: "role.updated" },
              { entityType: "role" },
            ],
          },
        }),
      );
    });
  });
});
