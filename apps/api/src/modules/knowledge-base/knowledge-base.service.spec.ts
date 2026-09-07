import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { KnowledgeBaseService } from "./knowledge-base.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { TenantContext } from "../../common/tenant/tenant-context";

function buildPrismaMock() {
  const prisma: {
    knowledgeBaseArticle: {
      count: ReturnType<typeof vi.fn>;
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
    // RM-27 — `requireCategoryInScope`'s lookup, plus `findUnique` for the
    // version-snapshot category-name resolution in `updateArticle`.
    // Defaults to a truthy match so every pre-existing test that passes a
    // `categoryId` through `updateArticle`/`createArticle` without itself
    // caring about category-scope validation continues to exercise the
    // exact same downstream behavior it always has — mirrors
    // `tickets.service.spec.ts`'s own `ticketCategory` mock exactly.
    knowledgeBaseCategory: {
      findFirst: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
    };
    $queryRaw: ReturnType<typeof vi.fn>;
    $transaction: ReturnType<typeof vi.fn>;
  } = {
    knowledgeBaseArticle: {
      // Story S-8c — `paginate` issues this alongside `findMany`.
      count: vi.fn().mockResolvedValue(0),
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
    knowledgeBaseCategory: {
      findFirst: vi.fn().mockResolvedValue({ id: "category-1" }),
      findUnique: vi.fn().mockResolvedValue(null),
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

/** RM-27 — mirrors `toArticleSummary`'s own flattening exactly, so test
 * fixtures never have to hand-duplicate it. Only used to build expected
 * *output* shapes from a raw Prisma-relation-shaped row fixture. */
function expectedSummary(row: {
  id: string;
  branchId: string;
  title: string;
  body: string;
  categoryId: string | null;
  category: { name: string } | null;
  status: string;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    branchId: row.branchId,
    title: row.title,
    body: row.body,
    categoryId: row.categoryId,
    categoryName: row.category?.name ?? null,
    status: row.status,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const CATEGORY_NAME_INCLUDE = { category: { select: { name: true } } };

describe("KnowledgeBaseService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let tenantContext: ReturnType<typeof buildTenantContextMock>;
  let service: KnowledgeBaseService;

  // RM-27 — the Prisma-relation shape (`categoryId` + `category: {name}|null`),
  // exactly what a `findFirst`/`findMany`/`create`/`update` call carrying
  // `include: CATEGORY_NAME_INCLUDE` actually returns.
  const baseArticleRow = {
    id: "article-1",
    branchId: "branch-1",
    title: "How to reset a password",
    body: "Step-by-step instructions...",
    categoryId: null as string | null,
    category: null as { name: string } | null,
    status: "DRAFT" as const,
    publishedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
  const baseArticleSummary = expectedSummary(baseArticleRow);

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
      expect(prisma.knowledgeBaseCategory.findFirst).not.toHaveBeenCalled();
      expect(prisma.knowledgeBaseArticle.create).toHaveBeenCalledWith({
        data: {
          branchId: "branch-1",
          title: "How to reset a password",
          body: "Step-by-step instructions...",
          categoryId: null,
        },
        include: CATEGORY_NAME_INCLUDE,
      });
      expect(result).toEqual(baseArticleSummary);
    });

    it("validates categoryId in scope and passes it through when given", async () => {
      prisma.knowledgeBaseCategory.findFirst.mockResolvedValue({ id: "category-1" });
      prisma.knowledgeBaseArticle.create.mockResolvedValue({
        ...baseArticleRow,
        categoryId: "category-1",
        category: { name: "account" },
      });

      await service.createArticle({
        title: "How to reset a password",
        body: "Step-by-step instructions...",
        categoryId: "category-1",
      });

      expect(prisma.knowledgeBaseCategory.findFirst).toHaveBeenCalledWith({
        where: { id: "category-1", branchId: "branch-1" },
      });
      expect(prisma.knowledgeBaseArticle.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ categoryId: "category-1" }) }),
      );
    });

    it("throws NotFoundException for an unknown categoryId, never creating the article", async () => {
      prisma.knowledgeBaseCategory.findFirst.mockResolvedValue(null);

      await expect(
        service.createArticle({
          title: "How to reset a password",
          body: "Step-by-step instructions...",
          categoryId: "unknown-category",
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.knowledgeBaseArticle.create).not.toHaveBeenCalled();
    });
  });

  describe("listArticles", () => {
    it("scopes the query to the caller's active branch, ordered updatedAt desc", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([]);

      await service.listArticles();

      expect(tenantContext.requireBranchScope).toHaveBeenCalledOnce();
      expect(prisma.knowledgeBaseArticle.findMany).toHaveBeenCalledWith({
        where: { branchId: "branch-1" },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip: 0,
        take: 25,
        include: CATEGORY_NAME_INCLUDE,
      });
    });

    it("returns [] for a branch with no articles", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([]);

      const result = await service.listArticles();

      expect(result.items).toEqual([]);
    });

    // Story 106 — Bounded Result Caps.
    it("pages the plain-path query, defaulting to 25 rows from the first page", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([]);

      await service.listArticles();

      expect(prisma.knowledgeBaseArticle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 25 }),
      );
    });

    // RM-05 — `status` filter (agent-facing, additive).
    it("adds a status filter to the plain-list path's where clause when given", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([]);

      await service.listArticles({ status: "PUBLISHED" });

      expect(prisma.knowledgeBaseArticle.findMany).toHaveBeenCalledWith({
        where: { branchId: "branch-1", status: "PUBLISHED" },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip: 0,
        take: 25,
        include: CATEGORY_NAME_INCLUDE,
      });
    });

    it("omits the status filter entirely when not given, unchanged from before this story", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([]);

      await service.listArticles();

      expect(prisma.knowledgeBaseArticle.findMany).toHaveBeenCalledWith({
        where: { branchId: "branch-1" },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip: 0,
        take: 25,
        include: CATEGORY_NAME_INCLUDE,
      });
    });

    // RM-27 — `categoryId` filter.
    it("adds a categoryId filter to the plain-list path's where clause when given", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([]);

      await service.listArticles({ categoryId: "category-1" });

      expect(prisma.knowledgeBaseArticle.findMany).toHaveBeenCalledWith({
        where: { branchId: "branch-1", categoryId: "category-1" },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip: 0,
        take: 25,
        include: CATEGORY_NAME_INCLUDE,
      });
    });

    it("adds a PUBLISHED status filter to the full-text-search path's SQL when status: PUBLISHED is given", async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await service.listArticles({ search: "password", status: "PUBLISHED" });

      const [strings] = prisma.$queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
      expect(strings.join("")).toContain("'PUBLISHED'");
    });

    // RM-27 — `categoryId` filter on the full-text-search path.
    it("adds a categoryId filter to the full-text-search path's SQL when given", async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await service.listArticles({ search: "password", categoryId: "category-1" });

      const [strings, ...values] = prisma.$queryRaw.mock.calls[0] as [
        TemplateStringsArray,
        ...unknown[],
      ];
      expect(strings.join("")).toContain("a.category_id");
      expect(values).toContain("category-1");
    });

    it("omits the categoryId filter entirely when not given, unchanged from before this story", async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await service.listArticles({ search: "password" });

      const [, ...values] = prisma.$queryRaw.mock.calls[0] as [
        TemplateStringsArray,
        ...unknown[],
      ];
      expect(values).toEqual(["branch-1", "password", "password", 25, 0]);
    });

    // Story 102 — Full-Text Search.
    it("matches via $queryRaw full-text search when search is given, bypassing findMany", async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await service.listArticles({ search: "password" });

      expect(prisma.knowledgeBaseArticle.findMany).not.toHaveBeenCalled();
      // Story S-8c — two now: the page of rows, then its count.
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
      const [strings, ...values] = prisma.$queryRaw.mock.calls[0] as [
        TemplateStringsArray,
        ...unknown[],
      ];
      // Story S-8c — LIMIT/OFFSET replace the old fixed cap.
      expect(values).toEqual(["branch-1", "password", "password", 25, 0]);
      expect(strings.join("")).toContain("websearch_to_tsquery");
      expect(strings.join("")).not.toContain("'PUBLISHED'");
      expect(strings.join("")).toContain("LIMIT");
    });

    it("maps raw $queryRaw rows through the same shape as the plain-list path", async () => {
      // RM-27 — the raw SQL row is already flat (categoryId/categoryName),
      // unlike the Prisma-relation-shaped `baseArticleRow` — see
      // `RawArticleRow`'s own doc comment.
      prisma.$queryRaw.mockResolvedValue([baseArticleSummary]);

      const result = await service.listArticles({ search: "password" });

      expect(result.items).toEqual([baseArticleSummary]);
    });

    it("treats a whitespace-only search as no search at all", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([]);

      await service.listArticles({ search: "   " });

      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(prisma.knowledgeBaseArticle.findMany).toHaveBeenCalledWith({
        where: { branchId: "branch-1" },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip: 0,
        take: 25,
        include: CATEGORY_NAME_INCLUDE,
      });
    });

    it("behaves identically to the no-arg call when search is an empty string", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([]);

      await service.listArticles({ search: "" });

      expect(prisma.knowledgeBaseArticle.findMany).toHaveBeenCalledWith({
        where: { branchId: "branch-1" },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip: 0,
        take: 25,
        include: CATEGORY_NAME_INCLUDE,
      });
    });

    // Story 109 — Multi-locale content.
    it("resolves each article's AR title/body when a matching translation exists", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([baseArticleRow]);
      prisma.knowledgeBaseArticleTranslation.findMany.mockResolvedValue([
        {
          id: "t1",
          articleId: "article-1",
          locale: "AR",
          title: "كيفية إعادة تعيين كلمة المرور",
          body: "تعليمات...",
        },
      ]);

      const result = await service.listArticles({ locale: "AR" as never });

      expect(prisma.knowledgeBaseArticleTranslation.findMany).toHaveBeenCalledWith({
        where: { articleId: { in: ["article-1"] }, locale: "AR" },
      });
      expect(result.items).toEqual([
        { ...baseArticleSummary, title: "كيفية إعادة تعيين كلمة المرور", body: "تعليمات..." },
      ]);
    });

    it("falls back to the base title/body when no translation exists for the requested locale", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([baseArticleRow]);
      prisma.knowledgeBaseArticleTranslation.findMany.mockResolvedValue([]);

      const result = await service.listArticles({ locale: "AR" as never });

      expect(result.items).toEqual([baseArticleSummary]);
    });

    it("never queries translations when locale is omitted", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([baseArticleRow]);

      const result = await service.listArticles();

      expect(prisma.knowledgeBaseArticleTranslation.findMany).not.toHaveBeenCalled();
      expect(result.items).toEqual([baseArticleSummary]);
    });
  });

  describe("getArticle", () => {
    it("throws NotFoundException for an unknown/out-of-scope id", async () => {
      prisma.knowledgeBaseArticle.findFirst.mockResolvedValue(null);

      await expect(service.getArticle("missing-id")).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.knowledgeBaseArticle.findFirst).toHaveBeenCalledWith({
        where: { id: "missing-id", branchId: "branch-1" },
        include: CATEGORY_NAME_INCLUDE,
      });
    });

    it("returns the base article when no locale is given", async () => {
      prisma.knowledgeBaseArticle.findFirst.mockResolvedValue(baseArticleRow);

      const result = await service.getArticle("article-1");

      expect(prisma.knowledgeBaseArticleTranslation.findMany).not.toHaveBeenCalled();
      expect(result).toEqual(baseArticleSummary);
    });

    // Story 109 — Multi-locale content.
    it("resolves the AR title/body when a matching translation exists", async () => {
      prisma.knowledgeBaseArticle.findFirst.mockResolvedValue(baseArticleRow);
      prisma.knowledgeBaseArticleTranslation.findMany.mockResolvedValue([
        {
          id: "t1",
          articleId: "article-1",
          locale: "AR",
          title: "العنوان بالعربية",
          body: "النص بالعربية",
        },
      ]);

      const result = await service.getArticle("article-1", "AR" as never);

      expect(result).toEqual({
        ...baseArticleSummary,
        title: "العنوان بالعربية",
        body: "النص بالعربية",
      });
    });

    it("falls back to the base title/body when no AR translation exists", async () => {
      prisma.knowledgeBaseArticle.findFirst.mockResolvedValue(baseArticleRow);
      prisma.knowledgeBaseArticleTranslation.findMany.mockResolvedValue([]);

      const result = await service.getArticle("article-1", "AR" as never);

      expect(result).toEqual(baseArticleSummary);
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
        include: CATEGORY_NAME_INCLUDE,
      });
    });

    it("sets publishedAt to a new Date when status is PUBLISHED", async () => {
      prisma.knowledgeBaseArticle.findFirst.mockResolvedValue(baseArticleRow);

      await service.updateArticle("article-1", { status: "PUBLISHED" as never });

      expect(prisma.knowledgeBaseArticle.update).toHaveBeenCalledWith({
        where: { id: "article-1" },
        data: { status: "PUBLISHED", publishedAt: expect.any(Date) },
        include: CATEGORY_NAME_INCLUDE,
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
        include: CATEGORY_NAME_INCLUDE,
      });
    });

    it("leaves publishedAt untouched when status is omitted entirely", async () => {
      prisma.knowledgeBaseArticle.findFirst.mockResolvedValue(baseArticleRow);

      await service.updateArticle("article-1", { body: "Revised instructions..." });

      expect(prisma.knowledgeBaseArticle.update).toHaveBeenCalledWith({
        where: { id: "article-1" },
        data: { body: "Revised instructions..." },
        include: CATEGORY_NAME_INCLUDE,
      });
    });

    // RM-27 — categoryId validation.
    it("validates a given categoryId is in scope before applying it", async () => {
      prisma.knowledgeBaseArticle.findFirst.mockResolvedValue(baseArticleRow);
      prisma.knowledgeBaseCategory.findFirst.mockResolvedValue({ id: "category-1" });

      await service.updateArticle("article-1", { categoryId: "category-1" });

      expect(prisma.knowledgeBaseCategory.findFirst).toHaveBeenCalledWith({
        where: { id: "category-1", branchId: "branch-1" },
      });
      expect(prisma.knowledgeBaseArticle.update).toHaveBeenCalledWith({
        where: { id: "article-1" },
        data: { categoryId: "category-1" },
        include: CATEGORY_NAME_INCLUDE,
      });
    });

    it("throws NotFoundException for an unknown categoryId, never updating the article", async () => {
      prisma.knowledgeBaseArticle.findFirst.mockResolvedValue(baseArticleRow);
      prisma.knowledgeBaseCategory.findFirst.mockResolvedValue(null);

      await expect(
        service.updateArticle("article-1", { categoryId: "unknown-category" }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.knowledgeBaseArticle.update).not.toHaveBeenCalled();
    });

    it("never validates categoryId when it is explicitly cleared (null)", async () => {
      prisma.knowledgeBaseArticle.findFirst.mockResolvedValue({
        ...baseArticleRow,
        categoryId: "category-1",
        category: { name: "Billing" },
      });

      await service.updateArticle("article-1", { categoryId: null as never });

      expect(prisma.knowledgeBaseCategory.findFirst).not.toHaveBeenCalled();
      expect(prisma.knowledgeBaseArticle.update).toHaveBeenCalledWith({
        where: { id: "article-1" },
        data: { categoryId: null },
        include: CATEGORY_NAME_INCLUDE,
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
          category: null,
          publishedAt: expect.any(Date),
        },
      });
      expect(prisma.knowledgeBaseArticle.update).toHaveBeenCalledWith({
        where: { id: "article-1" },
        data: {
          title: "How to reset your password",
          status: "PUBLISHED",
          publishedAt: expect.any(Date),
        },
        include: CATEGORY_NAME_INCLUDE,
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
          category: null,
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

    // RM-27 — version snapshot category-name resolution.
    describe("version snapshot category-name resolution", () => {
      it("resolves the new category's current name when categoryId changes while publishing", async () => {
        prisma.knowledgeBaseArticle.findFirst.mockResolvedValue(baseArticleRow);
        prisma.knowledgeBaseCategory.findFirst.mockResolvedValue({ id: "category-2" });
        prisma.knowledgeBaseCategory.findUnique.mockResolvedValue({ name: "Billing" });

        await service.updateArticle("article-1", {
          categoryId: "category-2",
          status: "PUBLISHED" as never,
        });

        expect(prisma.knowledgeBaseCategory.findUnique).toHaveBeenCalledWith({
          where: { id: "category-2" },
          select: { name: true },
        });
        expect(prisma.knowledgeBaseArticleVersion.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ category: "Billing" }) }),
        );
      });

      it("keeps the existing article's resolved category name when categoryId is omitted", async () => {
        prisma.knowledgeBaseArticle.findFirst.mockResolvedValue({
          ...baseArticleRow,
          categoryId: "category-1",
          category: { name: "Billing" },
        });

        await service.updateArticle("article-1", { status: "PUBLISHED" as never });

        expect(prisma.knowledgeBaseCategory.findUnique).not.toHaveBeenCalled();
        expect(prisma.knowledgeBaseArticleVersion.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ category: "Billing" }) }),
        );
      });

      it("clears the version's category name to null when categoryId is explicitly cleared while publishing", async () => {
        prisma.knowledgeBaseArticle.findFirst.mockResolvedValue({
          ...baseArticleRow,
          categoryId: "category-1",
          category: { name: "Billing" },
        });

        await service.updateArticle("article-1", {
          categoryId: null as never,
          status: "PUBLISHED" as never,
        });

        expect(prisma.knowledgeBaseCategory.findUnique).not.toHaveBeenCalled();
        expect(prisma.knowledgeBaseArticleVersion.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ category: null }) }),
        );
      });
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
  const publishedArticleSummary = expectedSummary(publishedArticleRow);

  describe("listPublishedArticlesForBranch", () => {
    it("scopes the query to the given branch and PUBLISHED status, ordered publishedAt desc", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([]);

      await service.listPublishedArticlesForBranch("branch-1");

      expect(prisma.knowledgeBaseArticle.findMany).toHaveBeenCalledWith({
        where: { branchId: "branch-1", status: "PUBLISHED" },
        orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
        skip: 0,
        take: 25,
        include: CATEGORY_NAME_INCLUDE,
      });
    });

    it("returns [] for a branch with no published articles", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([]);

      const result = await service.listPublishedArticlesForBranch("branch-1");

      expect(result.items).toEqual([]);
    });

    // Story 106 — Bounded Result Caps.
    it("pages the plain-path query, defaulting to 25 rows from the first page", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([]);

      await service.listPublishedArticlesForBranch("branch-1");

      expect(prisma.knowledgeBaseArticle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 25 }),
      );
    });

    // Story 102 — Full-Text Search.
    it("matches via $queryRaw full-text search, restricted to PUBLISHED, when search is given", async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await service.listPublishedArticlesForBranch("branch-1", { search: "password" });

      expect(prisma.knowledgeBaseArticle.findMany).not.toHaveBeenCalled();
      // Story S-8c — two now: the page of rows, then its count.
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
      const [strings, ...values] = prisma.$queryRaw.mock.calls[0] as [
        TemplateStringsArray,
        ...unknown[],
      ];
      // Story S-8c — LIMIT/OFFSET replace the old fixed cap.
      expect(values).toEqual(["branch-1", "password", "password", 25, 0]);
      expect(strings.join("")).toContain("websearch_to_tsquery");
      expect(strings.join("")).toContain("'PUBLISHED'");
      expect(strings.join("")).toContain("LIMIT");
    });

    it("treats a whitespace-only search as no search at all", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([]);

      await service.listPublishedArticlesForBranch("branch-1", { search: "   " });

      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(prisma.knowledgeBaseArticle.findMany).toHaveBeenCalledWith({
        where: { branchId: "branch-1", status: "PUBLISHED" },
        orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
        skip: 0,
        take: 25,
        include: CATEGORY_NAME_INCLUDE,
      });
    });

    it("behaves identically to the no-search call when search is an empty string", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([]);

      await service.listPublishedArticlesForBranch("branch-1", { search: "" });

      expect(prisma.knowledgeBaseArticle.findMany).toHaveBeenCalledWith({
        where: { branchId: "branch-1", status: "PUBLISHED" },
        orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
        skip: 0,
        take: 25,
        include: CATEGORY_NAME_INCLUDE,
      });
    });

    // Story 109 — Multi-locale content.
    it("resolves the AR title/body when a matching translation exists", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([publishedArticleRow]);
      prisma.knowledgeBaseArticleTranslation.findMany.mockResolvedValue([
        { id: "t1", articleId: publishedArticleRow.id, locale: "AR", title: "عنوان", body: "نص" },
      ]);

      const result = await service.listPublishedArticlesForBranch("branch-1", {
        locale: "AR" as never,
      });

      expect(result.items).toEqual([{ ...publishedArticleSummary, title: "عنوان", body: "نص" }]);
    });

    it("falls back to the base title/body when no translation exists for the requested locale", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([publishedArticleRow]);
      prisma.knowledgeBaseArticleTranslation.findMany.mockResolvedValue([]);

      const result = await service.listPublishedArticlesForBranch("branch-1", {
        locale: "AR" as never,
      });

      expect(result.items).toEqual([publishedArticleSummary]);
    });
  });

  describe("getPublishedArticleForBranch", () => {
    it("returns the article when found published in the given branch", async () => {
      prisma.knowledgeBaseArticle.findFirst.mockResolvedValue(publishedArticleRow);

      const result = await service.getPublishedArticleForBranch("article-2", "branch-1");

      expect(prisma.knowledgeBaseArticle.findFirst).toHaveBeenCalledWith({
        where: { id: "article-2", branchId: "branch-1", status: "PUBLISHED" },
        include: CATEGORY_NAME_INCLUDE,
      });
      expect(result).toEqual(publishedArticleSummary);
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

      expect(result).toEqual({ ...publishedArticleSummary, title: "عنوان", body: "نص" });
    });

    it("falls back to the base title/body when no translation exists for the requested locale", async () => {
      prisma.knowledgeBaseArticle.findFirst.mockResolvedValue(publishedArticleRow);
      prisma.knowledgeBaseArticleTranslation.findMany.mockResolvedValue([]);

      const result = await service.getPublishedArticleForBranch(
        "article-2",
        "branch-1",
        "AR" as never,
      );

      expect(result).toEqual(publishedArticleSummary);
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
        include: CATEGORY_NAME_INCLUDE,
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

  /**
   * Story S-8c — the two list endpoints page, and both branches of each
   * (plain listing and `ts_rank` full-text search) return the same
   * envelope, so a caller cannot tell from the shape which path ran.
   */
  describe("pagination (Story S-8c)", () => {
    it("translates a page number into the right offset on the plain path", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([]);

      await service.listArticles({ page: 3, pageSize: 10 });

      expect(prisma.knowledgeBaseArticle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it("reports the total and page count from a single count query", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([]);
      prisma.knowledgeBaseArticle.count.mockResolvedValue(57);

      const result = await service.listArticles({ page: 2, pageSize: 25 });

      expect(prisma.knowledgeBaseArticle.count).toHaveBeenCalledOnce();
      expect(result).toMatchObject({ total: 57, page: 2, pageSize: 25, totalPages: 3 });
    });

    it("counts over exactly the same where clause it fetches with", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([]);

      await service.listArticles();

      const countWhere = prisma.knowledgeBaseArticle.count.mock.calls[0]![0]!.where;
      const findWhere = prisma.knowledgeBaseArticle.findMany.mock.calls[0]![0]!.where;
      expect(countWhere).toEqual({ branchId: "branch-1" });
      // Not merely equal by value - literally the same object.
      expect(countWhere).toBe(findWhere);
    });

    it("keeps the PUBLISHED half of the portal scope in the count", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([]);

      await service.listPublishedArticlesForBranch("branch-1");

      // A portal reader must not learn a draft exists, including through
      // `total`.
      expect(prisma.knowledgeBaseArticle.count).toHaveBeenCalledWith({
        where: { branchId: "branch-1", status: "PUBLISHED" },
      });
    });

    it("returns an empty page past the end without losing the metadata", async () => {
      prisma.knowledgeBaseArticle.findMany.mockResolvedValue([]);
      prisma.knowledgeBaseArticle.count.mockResolvedValue(30);

      const result = await service.listArticles({ page: 99, pageSize: 10 });

      expect(result.items).toEqual([]);
      expect(result).toMatchObject({ total: 30, page: 99, totalPages: 3 });
    });

    it("pages the full-text search path with LIMIT/OFFSET and its own count", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 42 }]);

      const result = await service.listArticles({ search: "password", page: 3, pageSize: 5 });

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
      const [, ...rowValues] = prisma.$queryRaw.mock.calls[0] as [
        TemplateStringsArray,
        ...unknown[],
      ];
      expect(rowValues).toEqual(["branch-1", "password", "password", 5, 10]);
      expect(result).toMatchObject({ total: 42, page: 3, pageSize: 5, totalPages: 9 });
    });

    it("tiebreaks the ts_rank ordering by id", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0 }]);

      await service.listArticles({ search: "password" });

      // `ts_rank` ties constantly - two articles matching the same single
      // term usually score identically - so without this a paged search
      // would repeat and drop rows almost every time.
      const [strings] = prisma.$queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
      expect(strings.join("")).toContain("id DESC");
      expect(strings.join("")).toContain("OFFSET");
    });

    it("counts the search over the same predicate it fetches with", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0 }]);

      await service.listPublishedArticlesForBranch("branch-1", { search: "password" });

      const [rowStrings] = prisma.$queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
      const [countStrings, ...countValues] = prisma.$queryRaw.mock.calls[1] as [
        TemplateStringsArray,
        ...unknown[],
      ];
      // Both restricted to PUBLISHED, both against the same branch/term.
      expect(rowStrings.join("")).toContain("'PUBLISHED'");
      expect(countStrings.join("")).toContain("'PUBLISHED'");
      expect(countStrings.join("")).toContain("COUNT(*)");
      expect(countValues).toEqual(["branch-1", "password"]);
    });
  });
});
