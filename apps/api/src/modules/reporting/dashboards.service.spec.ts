import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { DashboardsService } from "./dashboards.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { TenantContext } from "../../common/tenant/tenant-context";

function buildPrismaMock() {
  const prisma: {
    reportDashboard: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    reportDashboardWidget: {
      createMany: ReturnType<typeof vi.fn>;
      deleteMany: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  } = {
    reportDashboard: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    reportDashboardWidget: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn((callback: (tx: unknown) => unknown) => callback(prisma)),
  };
  return prisma;
}

function buildTenantContextMock(
  branchId: string | null = "branch-1",
  userId: string | null = "user-1",
) {
  return {
    userId,
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
): DashboardsService {
  return new DashboardsService(
    prismaMock as unknown as PrismaService,
    tenantMock as unknown as TenantContext,
  );
}

function dashboardRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "dashboard-1",
    branchId: "branch-1",
    ownerUserId: "user-1",
    name: "My dashboard",
    isShared: false,
    widgets: [
      { id: "widget-1", dashboardId: "dashboard-1", widgetType: "TICKET_VOLUME", position: 0 },
      { id: "widget-2", dashboardId: "dashboard-1", widgetType: "CSAT", position: 1 },
    ],
    ...overrides,
  };
}

describe("DashboardsService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let tenantContext: ReturnType<typeof buildTenantContextMock>;
  let service: DashboardsService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
    tenantContext = buildTenantContextMock();
    service = createService(prisma, tenantContext);
  });

  describe("createDashboard", () => {
    it("assigns branchId/ownerUserId from TenantContext, not the DTO, and creates ordered widgets", async () => {
      prisma.reportDashboard.create.mockResolvedValue({ id: "dashboard-1" });

      const result = await service.createDashboard({
        name: "My dashboard",
        widgetTypes: ["TICKET_VOLUME", "CSAT"] as never,
      });

      expect(prisma.reportDashboard.create).toHaveBeenCalledWith({
        data: { branchId: "branch-1", ownerUserId: "user-1", name: "My dashboard", isShared: false },
      });
      expect(prisma.reportDashboardWidget.createMany).toHaveBeenCalledWith({
        data: [
          { dashboardId: "dashboard-1", widgetType: "TICKET_VOLUME", position: 0 },
          { dashboardId: "dashboard-1", widgetType: "CSAT", position: 1 },
        ],
      });
      expect(prisma.$transaction).toHaveBeenCalledOnce();
      expect(result).toEqual({ id: "dashboard-1" });
    });

    it("respects an explicit isShared: true", async () => {
      prisma.reportDashboard.create.mockResolvedValue({ id: "dashboard-1" });

      await service.createDashboard({
        name: "Shared dashboard",
        isShared: true,
        widgetTypes: ["TICKET_VOLUME"] as never,
      });

      expect(prisma.reportDashboard.create).toHaveBeenCalledWith({
        data: { branchId: "branch-1", ownerUserId: "user-1", name: "Shared dashboard", isShared: true },
      });
    });

    it("throws when no authenticated user exists on TenantContext", async () => {
      tenantContext.userId = null;

      await expect(
        service.createDashboard({ name: "x", widgetTypes: ["TICKET_VOLUME"] as never }),
      ).rejects.toThrow("TenantContext: no authenticated user on this request");
      expect(prisma.reportDashboard.create).not.toHaveBeenCalled();
    });
  });

  describe("listDashboards", () => {
    it("scopes by branch and (own OR shared), ordered createdAt asc", async () => {
      prisma.reportDashboard.findMany.mockResolvedValue([]);

      await service.listDashboards();

      expect(prisma.reportDashboard.findMany).toHaveBeenCalledWith({
        where: { branchId: "branch-1", OR: [{ ownerUserId: "user-1" }, { isShared: true }] },
        include: { widgets: { orderBy: { position: "asc" } } },
        orderBy: { createdAt: "asc" },
      });
    });

    it("maps rows to DashboardSummary, sorting widgets by position and flagging ownership", async () => {
      prisma.reportDashboard.findMany.mockResolvedValue([dashboardRow()]);

      const result = await service.listDashboards();

      expect(result).toEqual([
        {
          id: "dashboard-1",
          name: "My dashboard",
          isShared: false,
          isOwner: true,
          widgets: [
            { widgetType: "TICKET_VOLUME", position: 0 },
            { widgetType: "CSAT", position: 1 },
          ],
        },
      ]);
    });

    it("flags isOwner: false for a shared dashboard owned by someone else", async () => {
      prisma.reportDashboard.findMany.mockResolvedValue([
        dashboardRow({ ownerUserId: "someone-else", isShared: true }),
      ]);

      const result = await service.listDashboards();

      expect(result[0]).toMatchObject({ isOwner: false, isShared: true });
    });

    it("only filters on isShared when no authenticated user exists on TenantContext", async () => {
      tenantContext.userId = null;
      prisma.reportDashboard.findMany.mockResolvedValue([]);

      await service.listDashboards();

      expect(prisma.reportDashboard.findMany).toHaveBeenCalledWith({
        where: { branchId: "branch-1", isShared: true },
        include: { widgets: { orderBy: { position: "asc" } } },
        orderBy: { createdAt: "asc" },
      });
    });
  });

  describe("getDashboard", () => {
    it("throws NotFoundException when not found, not owned, and not shared", async () => {
      prisma.reportDashboard.findFirst.mockResolvedValue(null);

      await expect(service.getDashboard("dashboard-1")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("returns an owned dashboard", async () => {
      prisma.reportDashboard.findFirst.mockResolvedValue(dashboardRow());

      const result = await service.getDashboard("dashboard-1");

      expect(prisma.reportDashboard.findFirst).toHaveBeenCalledWith({
        where: {
          id: "dashboard-1",
          branchId: "branch-1",
          OR: [{ ownerUserId: "user-1" }, { isShared: true }],
        },
        include: { widgets: { orderBy: { position: "asc" } } },
      });
      expect(result.isOwner).toBe(true);
    });

    it("returns a shared dashboard owned by someone else, with isOwner: false", async () => {
      prisma.reportDashboard.findFirst.mockResolvedValue(
        dashboardRow({ ownerUserId: "someone-else", isShared: true }),
      );

      const result = await service.getDashboard("dashboard-1");

      expect(result.isOwner).toBe(false);
    });
  });

  describe("updateDashboard", () => {
    it("throws NotFoundException for a non-owner, even on a shared dashboard", async () => {
      prisma.reportDashboard.findFirst.mockResolvedValue(null);

      await expect(
        service.updateDashboard("dashboard-1", { name: "New name" }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.reportDashboard.update).not.toHaveBeenCalled();
    });

    it("scopes the ownership check by branchId AND ownerUserId, not branchId alone", async () => {
      prisma.reportDashboard.findFirst.mockResolvedValue(null);

      await expect(service.updateDashboard("dashboard-1", { name: "x" })).rejects.toBeInstanceOf(
        NotFoundException,
      );

      expect(prisma.reportDashboard.findFirst).toHaveBeenCalledWith({
        where: { id: "dashboard-1", branchId: "branch-1", ownerUserId: "user-1" },
      });
    });

    it("updates only the provided scalar fields", async () => {
      prisma.reportDashboard.findFirst.mockResolvedValue(dashboardRow());
      prisma.reportDashboard.update.mockResolvedValue({ id: "dashboard-1" });

      await service.updateDashboard("dashboard-1", { isShared: true });

      expect(prisma.reportDashboard.update).toHaveBeenCalledWith({
        where: { id: "dashboard-1" },
        data: { isShared: true },
      });
      expect(prisma.reportDashboardWidget.deleteMany).not.toHaveBeenCalled();
      expect(prisma.reportDashboardWidget.createMany).not.toHaveBeenCalled();
    });

    it("fully replaces the widget list when widgetTypes is provided", async () => {
      prisma.reportDashboard.findFirst.mockResolvedValue(dashboardRow());
      prisma.reportDashboard.update.mockResolvedValue({ id: "dashboard-1" });

      await service.updateDashboard("dashboard-1", {
        widgetTypes: ["CSAT", "TICKET_VOLUME"] as never,
      });

      expect(prisma.reportDashboardWidget.deleteMany).toHaveBeenCalledWith({
        where: { dashboardId: "dashboard-1" },
      });
      expect(prisma.reportDashboardWidget.createMany).toHaveBeenCalledWith({
        data: [
          { dashboardId: "dashboard-1", widgetType: "CSAT", position: 0 },
          { dashboardId: "dashboard-1", widgetType: "TICKET_VOLUME", position: 1 },
        ],
      });
    });
  });

  describe("deleteDashboard", () => {
    it("throws NotFoundException for a non-owner, even on a shared dashboard", async () => {
      prisma.reportDashboard.findFirst.mockResolvedValue(null);

      await expect(service.deleteDashboard("dashboard-1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.reportDashboard.delete).not.toHaveBeenCalled();
    });

    it("deletes an owned dashboard", async () => {
      prisma.reportDashboard.findFirst.mockResolvedValue(dashboardRow());
      prisma.reportDashboard.delete.mockResolvedValue({ id: "dashboard-1" });

      const result = await service.deleteDashboard("dashboard-1");

      expect(prisma.reportDashboard.delete).toHaveBeenCalledWith({ where: { id: "dashboard-1" } });
      expect(result).toEqual({ id: "dashboard-1" });
    });
  });
});
