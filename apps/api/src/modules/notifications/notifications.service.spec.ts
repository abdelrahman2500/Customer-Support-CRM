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
    /** Story 88 — also asserts `customerId: null`, which excludes
     * `PortalNotificationLogListener`'s rows (`ticket.updated`/agent-reply
     * `channel.message.created`, scoped to a customer, not this endpoint's
     * branch-wide agent audience) so this endpoint's result set is
     * unchanged by that story — regression coverage. */
    it("scopes the query through the ticket relation, not NotificationLog.branchId directly, and excludes customer-scoped rows", async () => {
      prisma.notificationLog.findMany.mockResolvedValue([]);

      await service.listNotifications();

      expect(tenantContext.requireBranchScope).toHaveBeenCalledOnce();
      expect(prisma.notificationLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { ticket: { branchId: "branch-1" }, customerId: null },
        }),
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

  describe("listNotificationsForCustomer", () => {
    it("filters directly by customerId, orders by loggedAt descending, and never touches TenantContext", async () => {
      prisma.notificationLog.findMany.mockResolvedValue([]);

      await service.listNotificationsForCustomer("customer-1");

      expect(tenantContext.requireBranchScope).not.toHaveBeenCalled();
      expect(prisma.notificationLog.findMany).toHaveBeenCalledWith({
        where: { customerId: "customer-1" },
        orderBy: { loggedAt: "desc" },
      });
    });

    it("returns an empty array when the customer has no notification history", async () => {
      prisma.notificationLog.findMany.mockResolvedValue([]);

      const result = await service.listNotificationsForCustomer("customer-1");

      expect(result).toEqual([]);
    });

    it("maps rows to NotificationSummary, with branchId/targetType/targetAt as stored (always null for portal rows)", async () => {
      const loggedAt = new Date("2026-09-01T10:00:00.000Z");
      prisma.notificationLog.findMany.mockResolvedValue([
        {
          id: "notif-3",
          eventType: "ticket.updated",
          ticketId: "ticket-1",
          branchId: null,
          targetType: null,
          targetAt: null,
          loggedAt,
          customerId: "customer-1",
        },
      ]);

      const result = await service.listNotificationsForCustomer("customer-1");

      expect(result).toEqual([
        {
          id: "notif-3",
          eventType: "ticket.updated",
          ticketId: "ticket-1",
          branchId: null,
          targetType: null,
          targetAt: null,
          loggedAt,
        },
      ]);
    });
  });
});
