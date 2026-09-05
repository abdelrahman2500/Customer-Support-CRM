import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuditLogsService } from "./audit-logs.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { TenantContext } from "../../common/tenant/tenant-context";

function buildPrismaMock() {
  return {
    auditLog: {
      // Story S-8a — `paginate` issues both queries from one `where`.
      count: vi.fn().mockResolvedValue(0),
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

    it("orders by createdAt descending, with id as a deterministic tiebreaker", async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);

      await service.listAuditLogs();

      // Story S-8a — `createdAt` alone is not unique (the interceptor
      // writes several rows per request), so paging over it alone would let
      // a row straddling a page boundary appear twice or not at all.
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: [{ createdAt: "desc" }, { id: "desc" }] }),
      );
    });

    it("returns an empty page when the branch has no audit log rows", async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);

      const result = await service.listAuditLogs();

      // `totalPages` floors at 1 so a UI can say "page 1 of 1" over an
      // empty table rather than "page 1 of 0".
      expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 25, totalPages: 1 });
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

      expect(result.items).toEqual([
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

      expect(result.items).toEqual([
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

    /**
     * Story S-8a — Story 104's unconditional `take: 200` cap is replaced by
     * real paging. The behavioural difference is what these assert: rows
     * past the ceiling are now reachable, and the response says how many
     * there are, instead of the array being quietly shortened.
     */
    describe("pagination (Story S-8a)", () => {
      it("defaults to the first page at a page size of 25", async () => {
        prisma.auditLog.findMany.mockResolvedValue([]);
        prisma.auditLog.count.mockResolvedValue(0);

        await service.listAuditLogs();

        expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ skip: 0, take: 25 }),
        );
      });

      it("translates a page number into the right offset", async () => {
        prisma.auditLog.findMany.mockResolvedValue([]);
        prisma.auditLog.count.mockResolvedValue(0);

        await service.listAuditLogs({ page: 3, pageSize: 10 });

        expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ skip: 20, take: 10 }),
        );
      });

      it("reports the total and page count from a single count query", async () => {
        prisma.auditLog.findMany.mockResolvedValue([]);
        prisma.auditLog.count.mockResolvedValue(57);

        const result = await service.listAuditLogs({ page: 2, pageSize: 25 });

        expect(prisma.auditLog.count).toHaveBeenCalledOnce();
        expect(result.total).toBe(57);
        expect(result.page).toBe(2);
        expect(result.pageSize).toBe(25);
        expect(result.totalPages).toBe(3);
      });

      it("returns an empty page past the end without losing the metadata", async () => {
        prisma.auditLog.findMany.mockResolvedValue([]);
        prisma.auditLog.count.mockResolvedValue(30);

        const result = await service.listAuditLogs({ page: 99, pageSize: 10 });

        expect(result.items).toEqual([]);
        expect(result.total).toBe(30);
        expect(result.page).toBe(99);
        expect(result.totalPages).toBe(3);
      });

      /**
       * The single-`where` guarantee, which is the reason `paginate` takes a
       * delegate rather than two caller-supplied promises. `total` is
       * authorization-visible: if it were counted over a wider scope than
       * `items`, it would disclose how many rows exist that this caller may
       * not read — here, rows outside the `branchId OR null` arm.
       */
      it("counts over exactly the same where clause it fetches with", async () => {
        prisma.auditLog.findMany.mockResolvedValue([]);
        prisma.auditLog.count.mockResolvedValue(0);

        await service.listAuditLogs({ action: "auth.login", actorId: undefined });

        const countWhere = prisma.auditLog.count.mock.calls[0]![0]!.where;
        const findWhere = prisma.auditLog.findMany.mock.calls[0]![0]!.where;
        expect(countWhere).toEqual(findWhere);
        // Not merely equal by value - literally the same object, so the two
        // cannot drift apart.
        expect(countWhere).toBe(findWhere);
      });

      it("keeps the branch/null authorization arm in the count", async () => {
        prisma.auditLog.findMany.mockResolvedValue([]);
        prisma.auditLog.count.mockResolvedValue(0);

        await service.listAuditLogs();

        expect(prisma.auditLog.count).toHaveBeenCalledWith({
          where: { OR: [{ branchId: "branch-1" }, { branchId: null }] },
        });
      });
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
            AND: [{ OR: [{ branchId: "branch-1" }, { branchId: null }] }, { entityType: "role" }],
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
            AND: [{ OR: [{ branchId: "branch-1" }, { branchId: null }] }, { actorId: "user-1" }],
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
      await expect(service.listAuditLogs({ from: "2026-06-05", to: "2026-06-01" })).rejects.toThrow(
        /from must not be after to/,
      );
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
