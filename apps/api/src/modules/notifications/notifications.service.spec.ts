import { beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";
import { NotificationsService } from "./notifications.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { TenantContext } from "../../common/tenant/tenant-context";

function buildPrismaMock() {
  return {
    notificationLog: {
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
): NotificationsService {
  return new NotificationsService(
    prismaMock as unknown as PrismaService,
    tenantMock as unknown as TenantContext,
  );
}

describe("NotificationsService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let tenantContext: ReturnType<typeof buildTenantContextMock>;
  let service: NotificationsService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    tenantContext = buildTenantContextMock();
    service = createService(prisma, tenantContext);
  });

  describe("listNotifications", () => {
    it("scopes the query through the ticket relation, not NotificationLog.branchId directly", async () => {
      prisma.notificationLog.findMany.mockResolvedValue([]);

      await service.listNotifications();

      expect(tenantContext.requireBranchScope).toHaveBeenCalledOnce();
      expect(prisma.notificationLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ticket: { branchId: "branch-1" } } }),
      );
    });

    it("returns an empty array when there are no notifications in the branch", async () => {
      prisma.notificationLog.findMany.mockResolvedValue([]);

      const result = await service.listNotifications();

      expect(result).toEqual([]);
    });

    it("maps sla.at_risk rows (which carry a real branchId of their own) as-is", async () => {
      const targetAt = new Date("2026-06-01T12:00:00.000Z");
      const loggedAt = new Date("2026-06-01T11:45:00.000Z");
      prisma.notificationLog.findMany.mockResolvedValue([
        {
          id: "notif-1",
          eventType: "sla.at_risk",
          ticketId: "ticket-1",
          branchId: "branch-1",
          targetType: "response",
          targetAt,
          loggedAt,
          ticket: { branchId: "branch-1" },
        },
      ]);

      const result = await service.listNotifications();

      expect(result).toEqual([
        {
          id: "notif-1",
          eventType: "sla.at_risk",
          ticketId: "ticket-1",
          branchId: "branch-1",
          targetType: "response",
          targetAt,
          loggedAt,
        },
      ]);
    });

    it("resolves branchId from the ticket relation for ticket.escalated rows, whose own branchId column is null", async () => {
      const loggedAt = new Date("2026-06-02T09:00:00.000Z");
      prisma.notificationLog.findMany.mockResolvedValue([
        {
          id: "notif-2",
          eventType: "ticket.escalated",
          ticketId: "ticket-2",
          branchId: null,
          targetType: null,
          targetAt: null,
          loggedAt,
          ticket: { branchId: "branch-1" },
        },
      ]);

      const result = await service.listNotifications();

      expect(result).toEqual([
        {
          id: "notif-2",
          eventType: "ticket.escalated",
          ticketId: "ticket-2",
          branchId: "branch-1",
          targetType: null,
          targetAt: null,
          loggedAt,
        },
      ]);
    });

    it("orders by loggedAt descending (newest first)", async () => {
      prisma.notificationLog.findMany.mockResolvedValue([]);

      await service.listNotifications();

      expect(prisma.notificationLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { loggedAt: "desc" } }),
      );
    });

    it("propagates TenantContext's error when there is no active branch", async () => {
      tenantContext = buildTenantContextMock(null);
      service = createService(prisma, tenantContext);

      await expect(service.listNotifications()).rejects.toThrow(/no active branch/);
    });
  });
});
