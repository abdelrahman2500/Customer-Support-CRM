import { beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";
import { NotificationsService } from "./notifications.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { TenantContext } from "../../common/tenant/tenant-context";

function buildPrismaMock() {
  return {
    notificationLog: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    contact: {
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
  };
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

    // Story 106 — Bounded Result Caps.
    it("caps every query at 200 rows, unconditionally", async () => {
      prisma.notificationLog.findMany.mockResolvedValue([]);

      await service.listNotifications();

      expect(prisma.notificationLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 200 }),
      );
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

  describe("getUnreadCount", () => {
    it("reuses listNotifications()'s exact scoping predicate, omitting the loggedAt filter when the caller's cursor is null", async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ notificationsReadAt: null });
      prisma.notificationLog.count.mockResolvedValue(3);

      const result = await service.getUnreadCount();

      expect(tenantContext.requireBranchScope).toHaveBeenCalledOnce();
      expect(prisma.user.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: "user-1" },
        select: { notificationsReadAt: true },
      });
      expect(prisma.notificationLog.count).toHaveBeenCalledWith({
        where: { ticket: { branchId: "branch-1" }, customerId: null },
      });
      expect(result).toEqual({ unreadCount: 3 });
    });

    it("includes a loggedAt > cursor filter once the caller has a real cursor", async () => {
      const readAt = new Date("2026-06-01T00:00:00.000Z");
      prisma.user.findUniqueOrThrow.mockResolvedValue({ notificationsReadAt: readAt });
      prisma.notificationLog.count.mockResolvedValue(0);

      await service.getUnreadCount();

      expect(prisma.notificationLog.count).toHaveBeenCalledWith({
        where: { ticket: { branchId: "branch-1" }, customerId: null, loggedAt: { gt: readAt } },
      });
    });
  });

  describe("markRead", () => {
    it("updates only the calling user's own row to the current time", async () => {
      prisma.user.update.mockResolvedValue({});

      const result = await service.markRead();

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { notificationsReadAt: result.readAt },
      });
    });
  });

  describe("getUnreadCountForCustomer", () => {
    it("scopes by customerId directly and omits the loggedAt filter when the contact's cursor is null", async () => {
      prisma.contact.findUniqueOrThrow.mockResolvedValue({ notificationsReadAt: null });
      prisma.notificationLog.count.mockResolvedValue(2);

      const result = await service.getUnreadCountForCustomer("contact-1", "customer-1");

      expect(prisma.contact.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: "contact-1" },
        select: { notificationsReadAt: true },
      });
      expect(prisma.notificationLog.count).toHaveBeenCalledWith({
        where: { customerId: "customer-1" },
      });
      expect(result).toEqual({ unreadCount: 2 });
    });

    it("includes a loggedAt > cursor filter once the contact has a real cursor", async () => {
      const readAt = new Date("2026-06-01T00:00:00.000Z");
      prisma.contact.findUniqueOrThrow.mockResolvedValue({ notificationsReadAt: readAt });
      prisma.notificationLog.count.mockResolvedValue(0);

      await service.getUnreadCountForCustomer("contact-1", "customer-1");

      expect(prisma.notificationLog.count).toHaveBeenCalledWith({
        where: { customerId: "customer-1", loggedAt: { gt: readAt } },
      });
    });
  });

  describe("markReadForContact", () => {
    it("updates only the given contact's own row to the current time", async () => {
      prisma.contact.update.mockResolvedValue({});

      const result = await service.markReadForContact("contact-1");

      expect(prisma.contact.update).toHaveBeenCalledWith({
        where: { id: "contact-1" },
        data: { notificationsReadAt: result.readAt },
      });
    });
  });
});
