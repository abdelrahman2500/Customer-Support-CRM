import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { QuickRepliesService } from "./quick-replies.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { TenantContext } from "../../common/tenant/tenant-context";

function buildPrismaMock() {
  return {
    quickReply: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
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
): QuickRepliesService {
  return new QuickRepliesService(
    prismaMock as unknown as PrismaService,
    tenantMock as unknown as TenantContext,
  );
}

const quickReplyRow = {
  id: "quick-reply-1",
  title: "Password reset instructions",
  body: "You can reset your password from the login page.",
  isActive: true,
};

describe("QuickRepliesService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let tenantContext: ReturnType<typeof buildTenantContextMock>;
  let service: QuickRepliesService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
    tenantContext = buildTenantContextMock();
    service = createService(prisma, tenantContext);
  });

  describe("createQuickReply", () => {
    it("assigns branchId from TenantContext, not the DTO", async () => {
      prisma.quickReply.create.mockResolvedValue(quickReplyRow);

      const result = await service.createQuickReply({
        title: "Password reset instructions",
        body: "You can reset your password from the login page.",
      });

      expect(prisma.quickReply.create).toHaveBeenCalledWith({
        data: {
          branchId: "branch-1",
          title: "Password reset instructions",
          body: "You can reset your password from the login page.",
        },
      });
      expect(result).toEqual(quickReplyRow);
    });
  });

  describe("listQuickReplies", () => {
    it("scopes the query by branch, ordered createdAt asc", async () => {
      prisma.quickReply.findMany.mockResolvedValue([]);

      await service.listQuickReplies();

      expect(prisma.quickReply.findMany).toHaveBeenCalledWith({
        where: { branchId: "branch-1" },
        orderBy: { createdAt: "asc" },
      });
    });

    it("maps rows to QuickReplySummary", async () => {
      prisma.quickReply.findMany.mockResolvedValue([quickReplyRow]);

      const result = await service.listQuickReplies();

      expect(result).toEqual([quickReplyRow]);
    });
  });

  describe("updateQuickReply", () => {
    it("throws NotFoundException for a quick reply in a different branch or unknown id", async () => {
      prisma.quickReply.findFirst.mockResolvedValue(null);

      await expect(
        service.updateQuickReply("quick-reply-1", { isActive: false }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.quickReply.update).not.toHaveBeenCalled();
    });

    it("updates only the provided fields (isActive alone)", async () => {
      prisma.quickReply.findFirst.mockResolvedValue(quickReplyRow);
      prisma.quickReply.update.mockResolvedValue({ id: "quick-reply-1" });

      const result = await service.updateQuickReply("quick-reply-1", { isActive: false });

      expect(prisma.quickReply.update).toHaveBeenCalledWith({
        where: { id: "quick-reply-1" },
        data: { isActive: false },
      });
      expect(result).toEqual({ id: "quick-reply-1" });
    });

    it("updates title/body together when both are provided", async () => {
      prisma.quickReply.findFirst.mockResolvedValue(quickReplyRow);
      prisma.quickReply.update.mockResolvedValue({ id: "quick-reply-1" });

      await service.updateQuickReply("quick-reply-1", {
        title: "New title",
        body: "New body",
      });

      expect(prisma.quickReply.update).toHaveBeenCalledWith({
        where: { id: "quick-reply-1" },
        data: { title: "New title", body: "New body" },
      });
    });
  });
});
