import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { KnowledgeBaseService } from "./knowledge-base.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { TenantContext } from "../../common/tenant/tenant-context";

function buildPrismaMock() {
  return {
    knowledgeBaseArticle: {
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
): KnowledgeBaseService {
  return new KnowledgeBaseService(
    prismaMock as unknown as PrismaService,
    tenantMock as unknown as TenantContext,
  );
}

describe("KnowledgeBaseService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let tenantContext: ReturnType<typeof buildTenantContextMock>;
  let service: KnowledgeBaseService;

  const baseArticleRow = {
    id: "article-1",
    branchId: "branch-1",
    title: "How to reset a password",
    body: "Step-by-step instructions...",
    category: null,
    status: "DRAFT" as const,
    publishedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
    tenantContext = buildTenantContextMock();
    service = createService(prisma, tenantContext);
  });

  describe("createArticle", () => {
    it("creates a DRAFT article scoped to the caller's branch", async () => {
      prisma.knowledgeBaseArticle.create.mockResolvedValue(baseArticleRow);

      const result = await service.createArticle({
        title: "How to reset a password",
        body: "Step-by-step instructions...",
      });

      expect(tenantContext.requireBranchScope).toHaveBeenCalledOnce();
      expect(prisma.knowledgeBaseArticle.create).toHaveBeenCalledWith({
        data: {
          branchId: "branch-1",
          title: "How to reset a password",
          body: "Step-by-step instructions...",
          category: null,
        },
      });
      expect(result).toEqual(baseArticleRow);
    });

    it("passes through category when given", async () => {
      prisma.knowledgeBaseArticle.create.mockResolvedValue({
        ...baseArticleRow,
        category: "account",
      });

      await service.createArticle({
        title: "How to reset a password",
        body: "Step-by-step instructions...",
        category: "account",
      });

      expect(prisma.knowledgeBaseArticle.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ category: "account" }) }),
      );
    });
  });

  describe("listArticles", () => {
    it("scopes the query to the caller's active branch, ordered updatedAt desc", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([]);

      await service.listArticles();

      expect(tenantContext.requireBranchScope).toHaveBeenCalledOnce();
      expect(prisma.knowledgeBaseArticle.findMany).toHaveBeenCalledWith({
        where: { branchId: "branch-1" },
        orderBy: { updatedAt: "desc" },
      });
    });

    it("returns [] for a branch with no articles", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([]);

      const result = await service.listArticles();

      expect(result).toEqual([]);
    });

    // Story 64 — Article Search.
    it("adds a title/body OR clause when search is given", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([]);

      await service.listArticles("password");

      expect(prisma.knowledgeBaseArticle.findMany).toHaveBeenCalledWith({
        where: {
          branchId: "branch-1",
          OR: [
            { title: { contains: "password", mode: "insensitive" } },
            { body: { contains: "password", mode: "insensitive" } },
          ],
        },
        orderBy: { updatedAt: "desc" },
      });
    });

    it("behaves identically to the no-arg call when search is an empty string", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([]);

      await service.listArticles("");

      expect(prisma.knowledgeBaseArticle.findMany).toHaveBeenCalledWith({
        where: { branchId: "branch-1" },
        orderBy: { updatedAt: "desc" },
      });
    });
  });

  describe("getArticle", () => {
    it("throws NotFoundException for an unknown/out-of-scope id", async () => {
      prisma.knowledgeBaseArticle.findFirst.mockResolvedValue(null);

      await expect(service.getArticle("missing-id")).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.knowledgeBaseArticle.findFirst).toHaveBeenCalledWith({
        where: { id: "missing-id", branchId: "branch-1" },
      });
    });
  });

  describe("updateArticle", () => {
    it("throws NotFoundException for an unknown/out-of-scope id", async () => {
      prisma.knowledgeBaseArticle.findFirst.mockResolvedValue(null);

      await expect(
        service.updateArticle("missing-id", { title: "New title" }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.knowledgeBaseArticle.update).not.toHaveBeenCalled();
    });

    it("only includes fields present in the DTO", async () => {
      prisma.knowledgeBaseArticle.findFirst.mockResolvedValue(baseArticleRow);

      await service.updateArticle("article-1", { title: "Updated title" });

      expect(prisma.knowledgeBaseArticle.update).toHaveBeenCalledWith({
        where: { id: "article-1" },
        data: { title: "Updated title" },
      });
    });

    it("sets publishedAt to a new Date when status is PUBLISHED", async () => {
      prisma.knowledgeBaseArticle.findFirst.mockResolvedValue(baseArticleRow);

      await service.updateArticle("article-1", { status: "PUBLISHED" as never });

      expect(prisma.knowledgeBaseArticle.update).toHaveBeenCalledWith({
        where: { id: "article-1" },
        data: { status: "PUBLISHED", publishedAt: expect.any(Date) },
      });
    });

    it("leaves publishedAt untouched when status is set back to DRAFT", async () => {
      prisma.knowledgeBaseArticle.findFirst.mockResolvedValue({
        ...baseArticleRow,
        status: "PUBLISHED",
        publishedAt: new Date("2026-01-02T00:00:00.000Z"),
      });

      await service.updateArticle("article-1", { status: "DRAFT" as never });

      expect(prisma.knowledgeBaseArticle.update).toHaveBeenCalledWith({
        where: { id: "article-1" },
        data: { status: "DRAFT" },
      });
    });

    it("leaves publishedAt untouched when status is omitted entirely", async () => {
      prisma.knowledgeBaseArticle.findFirst.mockResolvedValue(baseArticleRow);

      await service.updateArticle("article-1", { body: "Revised instructions..." });

      expect(prisma.knowledgeBaseArticle.update).toHaveBeenCalledWith({
        where: { id: "article-1" },
        data: { body: "Revised instructions..." },
      });
    });
  });

  // Story 54 — Customer Portal — Knowledge Base Browsing.
  const publishedArticleRow = {
    ...baseArticleRow,
    id: "article-2",
    status: "PUBLISHED" as const,
    publishedAt: new Date("2026-01-02T00:00:00.000Z"),
  };

  describe("listPublishedArticlesForBranch", () => {
    it("scopes the query to the given branch and PUBLISHED status, ordered publishedAt desc", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([]);

      await service.listPublishedArticlesForBranch("branch-1");

      expect(prisma.knowledgeBaseArticle.findMany).toHaveBeenCalledWith({
        where: { branchId: "branch-1", status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
      });
    });

    it("returns [] for a branch with no published articles", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([]);

      const result = await service.listPublishedArticlesForBranch("branch-1");

      expect(result).toEqual([]);
    });

    // Story 64 — Article Search.
    it("adds a title/body OR clause when search is given", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([]);

      await service.listPublishedArticlesForBranch("branch-1", "password");

      expect(prisma.knowledgeBaseArticle.findMany).toHaveBeenCalledWith({
        where: {
          branchId: "branch-1",
          status: "PUBLISHED",
          OR: [
            { title: { contains: "password", mode: "insensitive" } },
            { body: { contains: "password", mode: "insensitive" } },
          ],
        },
        orderBy: { publishedAt: "desc" },
      });
    });

    it("behaves identically to the no-search call when search is an empty string", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([]);

      await service.listPublishedArticlesForBranch("branch-1", "");

      expect(prisma.knowledgeBaseArticle.findMany).toHaveBeenCalledWith({
        where: { branchId: "branch-1", status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
      });
    });
  });

  describe("getPublishedArticleForBranch", () => {
    it("returns the article when found published in the given branch", async () => {
      prisma.knowledgeBaseArticle.findFirst.mockResolvedValue(publishedArticleRow);

      const result = await service.getPublishedArticleForBranch("article-2", "branch-1");

      expect(prisma.knowledgeBaseArticle.findFirst).toHaveBeenCalledWith({
        where: { id: "article-2", branchId: "branch-1", status: "PUBLISHED" },
      });
      expect(result).toEqual(publishedArticleRow);
    });

    it("throws NotFoundException for an unknown id", async () => {
      prisma.knowledgeBaseArticle.findFirst.mockResolvedValue(null);

      await expect(
        service.getPublishedArticleForBranch("missing-id", "branch-1"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("throws NotFoundException for a draft article (never confirms it exists)", async () => {
      // The `where` clause itself filters by status: PUBLISHED, so a draft
      // row never matches — this test documents that guarantee explicitly.
      prisma.knowledgeBaseArticle.findFirst.mockResolvedValue(null);

      await expect(
        service.getPublishedArticleForBranch("article-1", "branch-1"),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.knowledgeBaseArticle.findFirst).toHaveBeenCalledWith({
        where: { id: "article-1", branchId: "branch-1", status: "PUBLISHED" },
      });
    });

    it("throws NotFoundException for a published article in a different branch", async () => {
      prisma.knowledgeBaseArticle.findFirst.mockResolvedValue(null);

      await expect(
        service.getPublishedArticleForBranch("article-2", "branch-2"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
