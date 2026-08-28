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
    it("scopes the query directly by AuditLog.branchId", async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);

      await service.listAuditLogs();

      expect(tenantContext.requireBranchScope).toHaveBeenCalledOnce();
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { branchId: "branch-1" } }),
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

    it("propagates TenantContext's error when there is no active branch", async () => {
      tenantContext = buildTenantContextMock(null);
      service = createService(prisma, tenantContext);

      await expect(service.listAuditLogs()).rejects.toThrow(/no active branch/);
    });
  });
});
