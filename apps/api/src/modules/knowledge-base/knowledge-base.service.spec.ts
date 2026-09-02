import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { KnowledgeBaseService } from "./knowledge-base.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { TenantContext } from "../../common/tenant/tenant-context";

function buildPrismaMock() {
  const prisma: {
    knowledgeBaseArticle: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    knowledgeBaseArticleVersion: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
    };
    knowledgeBaseArticleTranslation: {
      findMany: ReturnType<typeof vi.fn>;
      upsert: ReturnType<typeof vi.fn>;
    };
    $queryRaw: ReturnType<typeof vi.fn>;
    $transaction: ReturnType<typeof vi.fn>;
  } = {
    knowledgeBaseArticle: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    knowledgeBaseArticleVersion: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    // Story 109 — `applyLocale`'s batched lookup and
    // `setArticleTranslation`'s `upsert`.
    knowledgeBaseArticleTranslation: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn(),
    },
    // Story 102 — `searchArticles`'s tagged-template `$queryRaw` calls.
    // Mocked as a plain function: invoking it as a tagged template
    // (`` prisma.$queryRaw`...${x}` ``) calls this mock with
    // `(stringsArray, ...interpolatedValues)`, exactly like a real one.
    $queryRaw: vi.fn(),
    // Story 65 — the interactive callback form: `tx` is the same mock
    // object as `prisma` itself, so assertions on
    // `prisma.knowledgeBaseArticleVersion.create` etc. see calls made
    // through `tx` too, exactly as if it were a real, single connection.
    $transaction: vi.fn((callback: (tx: unknown) => unknown) => callback(prisma)),
  };
  return prisma;
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
        take: 200,
      });
    });

    it("returns [] for a branch with no articles", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([]);

      const result = await service.listArticles();

      expect(result).toEqual([]);
    });

    // Story 106 — Bounded Result Caps.
    it("caps every plain-path query at 200 rows, unconditionally", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([]);

      await service.listArticles();

      expect(prisma.knowledgeBaseArticle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 200 }),
      );
    });

    // Story 102 — Full-Text Search.
    it("matches via $queryRaw full-text search when search is given, bypassing findMany", async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await service.listArticles("password");

      expect(prisma.knowledgeBaseArticle.findMany).not.toHaveBeenCalled();
      expect(prisma.$queryRaw).toHaveBeenCalledOnce();
      const [strings, ...values] = prisma.$queryRaw.mock.calls[0] as [
        TemplateStringsArray,
        ...unknown[],
      ];
      expect(values).toEqual(["branch-1", "password", "password", 200]);
      expect(strings.join("")).toContain("websearch_to_tsquery");
      expect(strings.join("")).not.toContain("'PUBLISHED'");
      expect(strings.join("")).toContain("LIMIT");
    });

    it("maps raw $queryRaw rows through the same shape as the plain-list path", async () => {
      prisma.$queryRaw.mockResolvedValue([baseArticleRow]);

      const result = await service.listArticles("password");

      expect(result).toEqual([baseArticleRow]);
    });

    it("treats a whitespace-only search as no search at all", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([]);

      await service.listArticles("   ");

      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(prisma.knowledgeBaseArticle.findMany).toHaveBeenCalledWith({
        where: { branchId: "branch-1" },
        orderBy: { updatedAt: "desc" },
        take: 200,
      });
    });

    it("behaves identically to the no-arg call when search is an empty string", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([]);

      await service.listArticles("");

      expect(prisma.knowledgeBaseArticle.findMany).toHaveBeenCalledWith({
        where: { branchId: "branch-1" },
        orderBy: { updatedAt: "desc" },
        take: 200,
      });
    });

    // Story 109 — Multi-locale content.
    it("resolves each article's AR title/body when a matching translation exists", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([baseArticleRow]);
      prisma.knowledgeBaseArticleTranslation.findMany.mockResolvedValue([
        { id: "t1", articleId: "article-1", locale: "AR", title: "كيفية إعادة تعيين كلمة المرور", body: "تعليمات..." },
      ]);

      const result = await service.listArticles(undefined, "AR" as never);

      expect(prisma.knowledgeBaseArticleTranslation.findMany).toHaveBeenCalledWith({
        where: { articleId: { in: ["article-1"] }, locale: "AR" },
      });
      expect(result).toEqual([
        { ...baseArticleRow, title: "كيفية إعادة تعيين كلمة المرور", body: "تعليمات..." },
      ]);
    });

    it("falls back to the base title/body when no translation exists for the requested locale", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([baseArticleRow]);
      prisma.knowledgeBaseArticleTranslation.findMany.mockResolvedValue([]);

      const result = await service.listArticles(undefined, "AR" as never);

      expect(result).toEqual([baseArticleRow]);
    });

    it("never queries translations when locale is omitted", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([baseArticleRow]);

      const result = await service.listArticles();

      expect(prisma.knowledgeBaseArticleTranslation.findMany).not.toHaveBeenCalled();
      expect(result).toEqual([baseArticleRow]);
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

    it("returns the base article when no locale is given", async () => {
      prisma.knowledgeBaseArticle.findFirst.mockResolvedValue(baseArticleRow);

      const result = await service.getArticle("article-1");

      expect(prisma.knowledgeBaseArticleTranslation.findMany).not.toHaveBeenCalled();
      expect(result).toEqual(baseArticleRow);
    });

    // Story 109 — Multi-locale content.
    it("resolves the AR title/body when a matching translation exists", async () => {
      prisma.knowledgeBaseArticle.findFirst.mockResolvedValue(baseArticleRow);
      prisma.knowledgeBaseArticleTranslation.findMany.mockResolvedValue([
        { id: "t1", articleId: "article-1", locale: "AR", title: "العنوان بالعربية", body: "النص بالعربية" },
      ]);

      const result = await service.getArticle("article-1", "AR" as never);

      expect(result).toEqual({ ...baseArticleRow, title: "العنوان بالعربية", body: "النص بالعربية" });
    });

    it("falls back to the base title/body when no AR translation exists", async () => {
      prisma.knowledgeBaseArticle.findFirst.mockResolvedValue(baseArticleRow);
      prisma.knowledgeBaseArticleTranslation.findMany.mockResolvedValue([]);

      const result = await service.getArticle("article-1", "AR" as never);

      expect(result).toEqual(baseArticleRow);
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

    // Story 65 — Article Version History.
    it("creates version 1 with the fully-merged content when publishing for the first time", async () => {
      prisma.knowledgeBaseArticle.findFirst.mockResolvedValue(baseArticleRow);
      prisma.knowledgeBaseArticleVersion.findFirst.mockResolvedValue(null);

      await service.updateArticle("article-1", {
        title: "How to reset your password",
        status: "PUBLISHED" as never,
      });

      expect(prisma.$transaction).toHaveBeenCalledOnce();
      expect(prisma.knowledgeBaseArticleVersion.findFirst).toHaveBeenCalledWith({
        where: { articleId: "article-1" },
        orderBy: { versionNumber: "desc" },
        select: { versionNumber: true },
      });
      expect(prisma.knowledgeBaseArticleVersion.create).toHaveBeenCalledWith({
        data: {
          articleId: "article-1",
          versionNumber: 1,
          title: "How to reset your password",
          body: baseArticleRow.body,
          category: baseArticleRow.category,
          publishedAt: expect.any(Date),
        },
      });
      expect(prisma.knowledgeBaseArticle.update).toHaveBeenCalledWith({
        where: { id: "article-1" },
        data: { title: "How to reset your password", status: "PUBLISHED", publishedAt: expect.any(Date) },
      });
    });

    it("creates a correctly-sequenced next version with the newly-edited content on a re-publish", async () => {
      prisma.knowledgeBaseArticle.findFirst.mockResolvedValue({
        ...baseArticleRow,
        status: "PUBLISHED",
        publishedAt: new Date("2026-01-02T00:00:00.000Z"),
      });
      prisma.knowledgeBaseArticleVersion.findFirst.mockResolvedValue({ versionNumber: 1 });

      await service.updateArticle("article-1", {
        body: "Revised, more detailed instructions...",
        status: "PUBLISHED" as never,
      });

      expect(prisma.knowledgeBaseArticleVersion.create).toHaveBeenCalledWith({
        data: {
          articleId: "article-1",
          versionNumber: 2,
          title: baseArticleRow.title,
          body: "Revised, more detailed instructions...",
          category: baseArticleRow.category,
          publishedAt: expect.any(Date),
        },
      });
    });

    it("creates no version for a plain content edit (no status change)", async () => {
      prisma.knowledgeBaseArticle.findFirst.mockResolvedValue(baseArticleRow);

      await service.updateArticle("article-1", { title: "Updated title" });

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.knowledgeBaseArticleVersion.create).not.toHaveBeenCalled();
    });

    it("creates no version when unpublishing", async () => {
      prisma.knowledgeBaseArticle.findFirst.mockResolvedValue({
        ...baseArticleRow,
        status: "PUBLISHED",
        publishedAt: new Date("2026-01-02T00:00:00.000Z"),
      });

      await service.updateArticle("article-1", { status: "DRAFT" as never });

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.knowledgeBaseArticleVersion.create).not.toHaveBeenCalled();
    });
  });

  describe("listArticleVersions", () => {
    it("throws NotFoundException for an unknown/out-of-scope id", async () => {
      prisma.knowledgeBaseArticle.findFirst.mockResolvedValue(null);

      await expect(service.listArticleVersions("missing-id")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.knowledgeBaseArticleVersion.findMany).not.toHaveBeenCalled();
    });

    it("returns versions newest-first for an in-scope article", async () => {
      prisma.knowledgeBaseArticle.findFirst.mockResolvedValue(baseArticleRow);
      const versionRow = {
        id: "version-1",
        articleId: "article-1",
        versionNumber: 2,
        title: "How to reset your password",
        body: "Revised instructions...",
        category: null,
        publishedAt: new Date("2026-01-03T00:00:00.000Z"),
        createdAt: new Date("2026-01-03T00:00:00.000Z"),
      };
      prisma.knowledgeBaseArticleVersion.findMany.mockResolvedValue([versionRow]);

      const result = await service.listArticleVersions("article-1");

      expect(prisma.knowledgeBaseArticleVersion.findMany).toHaveBeenCalledWith({
        where: { articleId: "article-1" },
        orderBy: { versionNumber: "desc" },
      });
      expect(result).toEqual([versionRow]);
    });

    it("returns [] for an article that has never been published", async () => {
      prisma.knowledgeBaseArticle.findFirst.mockResolvedValue(baseArticleRow);
      prisma.knowledgeBaseArticleVersion.findMany.mockResolvedValue([]);

      const result = await service.listArticleVersions("article-1");

      expect(result).toEqual([]);
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
        take: 200,
      });
    });

    it("returns [] for a branch with no published articles", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([]);

      const result = await service.listPublishedArticlesForBranch("branch-1");

      expect(result).toEqual([]);
    });

    // Story 106 — Bounded Result Caps.
    it("caps every plain-path query at 200 rows, unconditionally", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([]);

      await service.listPublishedArticlesForBranch("branch-1");

      expect(prisma.knowledgeBaseArticle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 200 }),
      );
    });

    // Story 102 — Full-Text Search.
    it("matches via $queryRaw full-text search, restricted to PUBLISHED, when search is given", async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await service.listPublishedArticlesForBranch("branch-1", "password");

      expect(prisma.knowledgeBaseArticle.findMany).not.toHaveBeenCalled();
      expect(prisma.$queryRaw).toHaveBeenCalledOnce();
      const [strings, ...values] = prisma.$queryRaw.mock.calls[0] as [
        TemplateStringsArray,
        ...unknown[],
      ];
      expect(values).toEqual(["branch-1", "password", "password", 200]);
      expect(strings.join("")).toContain("websearch_to_tsquery");
      expect(strings.join("")).toContain("'PUBLISHED'");
      expect(strings.join("")).toContain("LIMIT");
    });

    it("treats a whitespace-only search as no search at all", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([]);

      await service.listPublishedArticlesForBranch("branch-1", "   ");

      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(prisma.knowledgeBaseArticle.findMany).toHaveBeenCalledWith({
        where: { branchId: "branch-1", status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
        take: 200,
      });
    });

    it("behaves identically to the no-search call when search is an empty string", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([]);

      await service.listPublishedArticlesForBranch("branch-1", "");

      expect(prisma.knowledgeBaseArticle.findMany).toHaveBeenCalledWith({
        where: { branchId: "branch-1", status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
        take: 200,
      });
    });

    // Story 109 — Multi-locale content.
    it("resolves the AR title/body when a matching translation exists", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([publishedArticleRow]);
      prisma.knowledgeBaseArticleTranslation.findMany.mockResolvedValue([
        { id: "t1", articleId: publishedArticleRow.id, locale: "AR", title: "عنوان", body: "نص" },
      ]);

      const result = await service.listPublishedArticlesForBranch("branch-1", undefined, "AR" as never);

      expect(result).toEqual([{ ...publishedArticleRow, title: "عنوان", body: "نص" }]);
    });

    it("falls back to the base title/body when no translation exists for the requested locale", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([publishedArticleRow]);
      prisma.knowledgeBaseArticleTranslation.findMany.mockResolvedValue([]);

      const result = await service.listPublishedArticlesForBranch("branch-1", undefined, "AR" as never);

      expect(result).toEqual([publishedArticleRow]);
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

    // Story 109 — Multi-locale content.
    it("resolves the AR title/body when a matching translation exists", async () => {
      prisma.knowledgeBaseArticle.findFirst.mockResolvedValue(publishedArticleRow);
      prisma.knowledgeBaseArticleTranslation.findMany.mockResolvedValue([
        { id: "t1", articleId: publishedArticleRow.id, locale: "AR", title: "عنوان", body: "نص" },
      ]);

      const result = await service.getPublishedArticleForBranch(
        "article-2",
        "branch-1",
        "AR" as never,
      );

      expect(result).toEqual({ ...publishedArticleRow, title: "عنوان", body: "نص" });
    });

    it("falls back to the base title/body when no translation exists for the requested locale", async () => {
      prisma.knowledgeBaseArticle.findFirst.mockResolvedValue(publishedArticleRow);
      prisma.knowledgeBaseArticleTranslation.findMany.mockResolvedValue([]);

      const result = await service.getPublishedArticleForBranch(
        "article-2",
        "branch-1",
        "AR" as never,
      );

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

  // Story 109 — Multi-locale content.
  describe("setArticleTranslation", () => {
    it("throws NotFoundException for an unknown/out-of-scope id, never touching the translation table", async () => {
      prisma.knowledgeBaseArticle.findFirst.mockResolvedValue(null);

      await expect(
        service.setArticleTranslation("missing-id", "AR" as never, {
          title: "عنوان",
          body: "نص",
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.knowledgeBaseArticleTranslation.upsert).not.toHaveBeenCalled();
    });

    it("upserts the translation, keyed on the articleId/locale unique constraint", async () => {
      prisma.knowledgeBaseArticle.findFirst.mockResolvedValue(baseArticleRow);
      prisma.knowledgeBaseArticleTranslation.upsert.mockResolvedValue({
        id: "t1",
        articleId: "article-1",
        locale: "AR",
        title: "عنوان",
        body: "نص",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      });

      await service.setArticleTranslation("article-1", "AR" as never, {
        title: "عنوان",
        body: "نص",
      });

      expect(prisma.knowledgeBaseArticleTranslation.upsert).toHaveBeenCalledWith({
        where: { articleId_locale: { articleId: "article-1", locale: "AR" } },
        create: { articleId: "article-1", locale: "AR", title: "عنوان", body: "نص" },
        update: { title: "عنوان", body: "نص" },
      });
    });
  });

  describe("listArticleTranslations", () => {
    it("throws NotFoundException for an unknown/out-of-scope id", async () => {
      prisma.knowledgeBaseArticle.findFirst.mockResolvedValue(null);

      await expect(service.listArticleTranslations("missing-id")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.knowledgeBaseArticleTranslation.findMany).not.toHaveBeenCalled();
    });

    it("returns every translation currently set for the article", async () => {
      prisma.knowledgeBaseArticle.findFirst.mockResolvedValue(baseArticleRow);
      const translations = [
        { id: "t1", articleId: "article-1", locale: "AR", title: "عنوان", body: "نص" },
      ];
      prisma.knowledgeBaseArticleTranslation.findMany.mockResolvedValue(translations);

      const result = await service.listArticleTranslations("article-1");

      expect(prisma.knowledgeBaseArticleTranslation.findMany).toHaveBeenCalledWith({
        where: { articleId: "article-1" },
      });
      expect(result).toEqual(translations);
    });

    it("returns [] for an article with no translations set", async () => {
      prisma.knowledgeBaseArticle.findFirst.mockResolvedValue(baseArticleRow);
      prisma.knowledgeBaseArticleTranslation.findMany.mockResolvedValue([]);

      const result = await service.listArticleTranslations("article-1");

      expect(result).toEqual([]);
    });
  });
});
