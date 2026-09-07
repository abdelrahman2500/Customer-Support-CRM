import { beforeEach, describe, expect, it, vi } from "vitest";
import { WebhookSubscriptionsService } from "./webhook-subscriptions.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { TenantContext } from "../../common/tenant/tenant-context";

function buildPrismaMock() {
  return {
    webhookSubscription: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    webhookDeliveryAttempt: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
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
): WebhookSubscriptionsService {
  return new WebhookSubscriptionsService(
    prismaMock as unknown as PrismaService,
    tenantMock as unknown as TenantContext,
  );
}

const ROW = {
  id: "subscription-1",
  branchId: "branch-1",
  targetUrl: "https://example.test/hook",
  secret: "a-generated-secret",
  subscribedEventTypes: ["ticket.updated"],
  isActive: true,
  createdByUserId: "user-1",
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  updatedAt: new Date("2024-01-01T00:00:00.000Z"),
};

describe("WebhookSubscriptionsService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let tenantContext: ReturnType<typeof buildTenantContextMock>;
  let service: WebhookSubscriptionsService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    tenantContext = buildTenantContextMock();
    service = createService(prisma, tenantContext);
  });

  describe("createSubscription", () => {
    it("creates the row scoped to the caller's branch and acting user, with a freshly generated secret", async () => {
      prisma.webhookSubscription.create.mockResolvedValue(ROW);

      await service.createSubscription({
        targetUrl: "https://example.test/hook",
        subscribedEventTypes: ["ticket.updated"],
      });

      expect(prisma.webhookSubscription.create).toHaveBeenCalledWith({
        data: {
          branchId: "branch-1",
          targetUrl: "https://example.test/hook",
          secret: expect.any(String),
          subscribedEventTypes: ["ticket.updated"],
          createdByUserId: "user-1",
        },
      });
    });

    it("returns the secret exactly once, alongside the rest of the summary", async () => {
      prisma.webhookSubscription.create.mockResolvedValue(ROW);

      const result = await service.createSubscription({
        targetUrl: "https://example.test/hook",
        subscribedEventTypes: ["ticket.updated"],
      });

      expect(result).toEqual({
        id: "subscription-1",
        targetUrl: "https://example.test/hook",
        subscribedEventTypes: ["ticket.updated"],
        isActive: true,
        createdByUserId: "user-1",
        createdAt: ROW.createdAt,
        updatedAt: ROW.updatedAt,
        secret: expect.any(String),
      });
    });

    it("throws when no authenticated user exists on TenantContext", async () => {
      tenantContext = buildTenantContextMock("branch-1", null);
      service = createService(prisma, tenantContext);

      await expect(
        service.createSubscription({
          targetUrl: "https://example.test/hook",
          subscribedEventTypes: ["ticket.updated"],
        }),
      ).rejects.toThrow(/no authenticated user/);
    });
  });

  describe("listSubscriptions", () => {
    it("scopes the query to the caller's branch and never returns secret", async () => {
      prisma.webhookSubscription.findMany.mockResolvedValue([ROW]);

      const result = await service.listSubscriptions();

      expect(prisma.webhookSubscription.findMany).toHaveBeenCalledWith({
        where: { branchId: "branch-1" },
        orderBy: { createdAt: "desc" },
      });
      expect(result).toEqual([
        {
          id: "subscription-1",
          targetUrl: "https://example.test/hook",
          subscribedEventTypes: ["ticket.updated"],
          isActive: true,
          createdByUserId: "user-1",
          createdAt: ROW.createdAt,
          updatedAt: ROW.updatedAt,
        },
      ]);
      expect(result[0]).not.toHaveProperty("secret");
    });
  });

  describe("getSubscription", () => {
    it("throws NotFoundException when the subscription is outside the caller's branch", async () => {
      prisma.webhookSubscription.findFirst.mockResolvedValue(null);

      await expect(service.getSubscription("subscription-1")).rejects.toThrow(/not found/i);
    });
  });

  describe("updateSubscription", () => {
    it("404s before updating when the subscription is outside the caller's branch", async () => {
      prisma.webhookSubscription.findFirst.mockResolvedValue(null);

      await expect(
        service.updateSubscription("subscription-1", { isActive: false }),
      ).rejects.toThrow(/not found/i);
      expect(prisma.webhookSubscription.update).not.toHaveBeenCalled();
    });

    it("only includes fields explicitly present on the dto", async () => {
      prisma.webhookSubscription.findFirst.mockResolvedValue(ROW);
      prisma.webhookSubscription.update.mockResolvedValue({ ...ROW, isActive: false });

      await service.updateSubscription("subscription-1", { isActive: false });

      expect(prisma.webhookSubscription.update).toHaveBeenCalledWith({
        where: { id: "subscription-1" },
        data: { isActive: false },
      });
    });
  });

  describe("deleteSubscription", () => {
    it("404s before deleting when the subscription is outside the caller's branch", async () => {
      prisma.webhookSubscription.findFirst.mockResolvedValue(null);

      await expect(service.deleteSubscription("subscription-1")).rejects.toThrow(/not found/i);
      expect(prisma.webhookSubscription.delete).not.toHaveBeenCalled();
    });

    it("deletes once found in scope", async () => {
      prisma.webhookSubscription.findFirst.mockResolvedValue(ROW);

      await service.deleteSubscription("subscription-1");

      expect(prisma.webhookSubscription.delete).toHaveBeenCalledWith({ where: { id: "subscription-1" } });
    });
  });

  describe("listDeliveryAttempts", () => {
    it("404s when the subscription is outside the caller's branch", async () => {
      prisma.webhookSubscription.findFirst.mockResolvedValue(null);

      await expect(service.listDeliveryAttempts("subscription-1")).rejects.toThrow(/not found/i);
    });

    it("scopes the paginated query to the subscription, newest attempt first", async () => {
      prisma.webhookSubscription.findFirst.mockResolvedValue(ROW);

      await service.listDeliveryAttempts("subscription-1");

      expect(prisma.webhookDeliveryAttempt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { subscriptionId: "subscription-1" },
          orderBy: [{ attemptedAt: "desc" }, { id: "desc" }],
        }),
      );
    });
  });
});
