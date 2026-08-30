import { Injectable, NotFoundException } from "@nestjs/common";
import type { KnowledgeBaseArticleStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "../../common/tenant/tenant-context";
import type { CreateArticleDto } from "./dto/create-article.dto";
import type { UpdateArticleDto } from "./dto/update-article.dto";

export interface ArticleSummary {
  id: string;
  branchId: string;
  title: string;
  body: string;
  category: string | null;
  status: KnowledgeBaseArticleStatus;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Story 65 — one immutable snapshot of an article's content at the moment
 * it was published. Mirrors `ArticleSummary`'s own flat shape. */
export interface ArticleVersionSummary {
  id: string;
  articleId: string;
  versionNumber: number;
  title: string;
  body: string;
  category: string | null;
  publishedAt: Date;
  createdAt: Date;
}

/**
 * Owns the `knowledge_base` schema — see
 * docs/architecture/03-domain-boundaries.md ("Knowledge Base"). Story 51 —
 * foundation only: `KnowledgeBaseArticle` is a standalone, branch-scoped
 * aggregate root, the same shape as `SlaPolicy`/`Customer`/`Ticket` — never
 * a sub-entity of anything else. No AI Services consumption — see the
 * plan's Story Goal / Design items 3, 7.
 *
 * Story 64 — `listArticles`/`listPublishedArticlesForBranch` both take an
 * optional `search`, matching `title` or `body` via a plain `contains`/
 * `mode: "insensitive"` filter — not `tsvector`/GIN full-text search, which
 * this codebase has no existing raw-SQL precedent for (`$queryRaw` is used
 * exactly once, for a trivial healthcheck) and is deliberately deferred
 * until this simpler mechanism's relevance/performance is a measured
 * problem (mirrors `ReportingService`'s own "direct queries before
 * materialized views" precedent).
 *
 * Story 65 — every `PUBLISHED` transition in `updateArticle` also
 * snapshots the fully-merged post-update content into a new
 * `KnowledgeBaseArticleVersion` row (docs/architecture/08-supporting-
 * domains.md: "publishing creates a new version rather than mutating
 * published content"), inside the same `$transaction` as the article
 * update. A plain content edit or an unpublish creates no version.
 */
@Injectable()
export class KnowledgeBaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async createArticle(dto: CreateArticleDto): Promise<ArticleSummary> {
    const { branchId } = this.tenantContext.requireBranchScope();

    const article = await this.prisma.knowledgeBaseArticle.create({
      data: {
        branchId,
        title: dto.title,
        body: dto.body,
        category: dto.category ?? null,
      },
    });
    return toArticleSummary(article);
  }

  async listArticles(search?: string): Promise<ArticleSummary[]> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const articles = await this.prisma.knowledgeBaseArticle.findMany({
      where: { branchId, ...searchWhereClause(search) },
      orderBy: { updatedAt: "desc" },
    });
    return articles.map(toArticleSummary);
  }

  async getArticle(id: string): Promise<ArticleSummary> {
    const article = await this.findArticleInScope(id);
    return toArticleSummary(article);
  }

  /**
   * `publishedAt` is set to `now()` whenever `dto.status` is `PUBLISHED`
   * (including a re-publish after an edit) and left untouched otherwise — a
   * plain last-transition timestamp on the live row, not a version log
   * (plan Design item 5).
   *
   * Story 65 — that same `PUBLISHED` transition also snapshots the
   * fully-merged post-update content (an agent may edit and publish in one
   * call) into a new `KnowledgeBaseArticleVersion` row, inside the same
   * `$transaction` as the article `update` — a version is never created
   * without the corresponding publish landing, or vice versa (plan Design
   * items 1/2). A plain content edit or an unpublish creates no version.
   */
  async updateArticle(id: string, dto: UpdateArticleDto): Promise<{ id: string }> {
    const existing = await this.findArticleInScope(id);
    const isPublishing = dto.status === "PUBLISHED";

    const data = {
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.body !== undefined ? { body: dto.body } : {}),
      ...(dto.category !== undefined ? { category: dto.category } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(isPublishing ? { publishedAt: new Date() } : {}),
    };

    if (!isPublishing) {
      await this.prisma.knowledgeBaseArticle.update({ where: { id }, data });
      return { id };
    }

    const merged = {
      title: dto.title ?? existing.title,
      body: dto.body ?? existing.body,
      category: dto.category !== undefined ? dto.category : existing.category,
    };
    const publishedAt = data.publishedAt as Date;

    await this.prisma.$transaction(async (tx) => {
      const lastVersion = await tx.knowledgeBaseArticleVersion.findFirst({
        where: { articleId: id },
        orderBy: { versionNumber: "desc" },
        select: { versionNumber: true },
      });
      await tx.knowledgeBaseArticleVersion.create({
        data: {
          articleId: id,
          versionNumber: (lastVersion?.versionNumber ?? 0) + 1,
          title: merged.title,
          body: merged.body,
          category: merged.category,
          publishedAt,
        },
      });
      await tx.knowledgeBaseArticle.update({ where: { id }, data });
    });
    return { id };
  }

  /** Story 65 — newest-first. Reuses `findArticleInScope`'s existing
   * branch-scope/404 guarantee: a version is never reachable outside the
   * parent article's own branch scope, exactly like `getArticle`. */
  async listArticleVersions(id: string): Promise<ArticleVersionSummary[]> {
    await this.findArticleInScope(id);
    const versions = await this.prisma.knowledgeBaseArticleVersion.findMany({
      where: { articleId: id },
      orderBy: { versionNumber: "desc" },
    });
    return versions.map((version) => ({
      id: version.id,
      articleId: version.articleId,
      versionNumber: version.versionNumber,
      title: version.title,
      body: version.body,
      category: version.category,
      publishedAt: version.publishedAt,
      createdAt: version.createdAt,
    }));
  }

  // ---------------------------------------------------------------------
  // Story 54 — Customer Portal (published-only, branch-scoped, no
  // TenantContext — the caller's branch comes from the JWT's own claim,
  // see PortalKnowledgeBaseController). None of the existing agent-facing
  // methods above are touched.
  // ---------------------------------------------------------------------

  /** Most-recently-published first — every row is guaranteed
   * `status: PUBLISHED`, so `publishedAt` is never null here. */
  async listPublishedArticlesForBranch(
    branchId: string,
    search?: string,
  ): Promise<ArticleSummary[]> {
    const articles = await this.prisma.knowledgeBaseArticle.findMany({
      where: { branchId, status: "PUBLISHED", ...searchWhereClause(search) },
      orderBy: { publishedAt: "desc" },
    });
    return articles.map(toArticleSummary);
  }

  /** 404s identically for a draft article, one in a different branch, or an
   * unknown id — a portal caller never learns a draft exists. */
  async getPublishedArticleForBranch(id: string, branchId: string): Promise<ArticleSummary> {
    const article = await this.prisma.knowledgeBaseArticle.findFirst({
      where: { id, branchId, status: "PUBLISHED" },
    });
    if (!article) {
      throw new NotFoundException("Article not found");
    }
    return toArticleSummary(article);
  }

  // ---------------------------------------------------------------------
  // internals
  // ---------------------------------------------------------------------

  private async findArticleInScope(id: string): Promise<{
    id: string;
    branchId: string;
    title: string;
    body: string;
    category: string | null;
    status: KnowledgeBaseArticleStatus;
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const article = await this.prisma.knowledgeBaseArticle.findFirst({
      where: { id, branchId },
    });
    if (!article) {
      throw new NotFoundException("Article not found");
    }
    return article;
  }
}

/** Empty object (no-op `where` clause addition) for an empty/missing
 * `search` — every existing caller sees the exact same unfiltered query it
 * always has. `OR` on `title`/`body`, case-insensitive substring — plain
 * Prisma `contains`, never raw SQL (see this file's own doc comment for
 * why `tsvector` is deliberately deferred). */
function searchWhereClause(
  search: string | undefined,
): { OR: Prisma.KnowledgeBaseArticleWhereInput[] } | Record<string, never> {
  if (!search) {
    return {};
  }
  return {
    OR: [
      { title: { contains: search, mode: "insensitive" } },
      { body: { contains: search, mode: "insensitive" } },
    ],
  };
}

function toArticleSummary(article: {
  id: string;
  branchId: string;
  title: string;
  body: string;
  category: string | null;
  status: KnowledgeBaseArticleStatus;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): ArticleSummary {
  return {
    id: article.id,
    branchId: article.branchId,
    title: article.title,
    body: article.body,
    category: article.category,
    status: article.status,
    publishedAt: article.publishedAt,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
  };
}
