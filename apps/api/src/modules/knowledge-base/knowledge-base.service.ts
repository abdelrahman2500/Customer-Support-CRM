import { Injectable, NotFoundException } from "@nestjs/common";
import type { KbLocale, KnowledgeBaseArticleStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "../../common/tenant/tenant-context";
import { paginate } from "../../common/pagination/paginate";
import { DEFAULT_PAGE_SIZE } from "../../common/pagination/pagination-query.dto";
import type { Paginated } from "../../common/pagination/paginated";
import { totalPagesFor } from "../../common/pagination/paginated";
import type { ListArticlesQueryDto } from "./dto/list-articles-query.dto";
import type { CreateArticleDto } from "./dto/create-article.dto";
import type { UpdateArticleDto } from "./dto/update-article.dto";
import type { SetArticleTranslationDto } from "./dto/set-article-translation.dto";

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

/** Story 109 — one article's content in one locale. */
export interface ArticleTranslationSummary {
  id: string;
  articleId: string;
  locale: KbLocale;
  title: string;
  body: string;
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
 * optional `search`.
 *
 * Story 102 — `search` now matches via real PostgreSQL full-text search
 * (`tsvector`/`websearch_to_tsquery`/`ts_rank`, see `searchArticles`
 * below), not the plain `contains`/`mode: "insensitive"` filter Story 64
 * originally shipped — see this story's own plan doc for why now (a
 * generated, GIN-indexed column) and why not further (no vector/semantic
 * search — a separate, later, AI-driven capability).
 *
 * Story 65 — every `PUBLISHED` transition in `updateArticle` also
 * snapshots the fully-merged post-update content into a new
 * `KnowledgeBaseArticleVersion` row (docs/architecture/08-supporting-
 * domains.md: "publishing creates a new version rather than mutating
 * published content"), inside the same `$transaction` as the article
 * update. A plain content edit or an unpublish creates no version.
 *
 * Story 109 — Multi-locale content. Every read method now takes an
 * optional `locale`. When given, and a matching
 * `KnowledgeBaseArticleTranslation` row exists, that translation's
 * `title`/`body` are substituted for the base article's own — resolved as
 * a small, separate post-processing step (`applyLocale`) over whatever
 * the existing, unmodified query already returned, never folded into the
 * query itself. This keeps every pre-existing query/test's behavior
 * byte-for-byte identical when `locale` is omitted (the common case,
 * still every agent-facing call site today), and avoids Prisma's
 * conditional-`include` typing complexity entirely. No translation for
 * the requested locale (or no `locale` given at all) silently falls back
 * to the base `title`/`body` — the same content every caller already saw
 * before this story, never a 404 or an empty field.
 * `setArticleTranslation`/`listArticleTranslations` are the write/list
 * side; `searchArticles` is deliberately untouched — full-text search
 * stays English-only against the base `search_vector` column (this
 * story's own plan doc, "Non-goals").
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

  /**
   * Story S-8c — `take: MAX_ARTICLE_ROWS` (200) replaced by real paging.
   *
   * Both branches return the same envelope, which is the point: a caller
   * cannot tell from the response shape whether its `search` sent the
   * request down the full-text path or the plain listing one, and a UI
   * pager works identically either way.
   */
  async listArticles(query: ListArticlesQueryDto = {}): Promise<Paginated<ArticleSummary>> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const search = query.search?.trim();
    if (search) {
      return this.applyLocaleToPage(
        await this.searchArticles(branchId, search, query),
        query.locale,
      );
    }
    // `id` tiebreaks `updatedAt`, which is not unique: a bulk import or a
    // batched publish writes several rows in the same millisecond, and
    // paging on a non-unique key lets a row straddling a page boundary
    // appear twice or vanish.
    const page = await paginate(this.prisma.knowledgeBaseArticle, {
      where: { branchId },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      page: query.page,
      pageSize: query.pageSize,
    });
    return this.applyLocaleToPage(
      { ...page, items: page.items.map(toArticleSummary) },
      query.locale,
    );
  }

  async getArticle(id: string, locale?: KbLocale): Promise<ArticleSummary> {
    const article = await this.findArticleInScope(id);
    return this.applyLocaleToOne(toArticleSummary(article), locale);
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

  /**
   * Story 109 — creates or replaces the article's translation for one
   * locale. Reuses `findArticleInScope`'s existing branch-scope/404
   * guarantee first — a translation is never reachable (or settable)
   * outside the parent article's own branch scope, exactly like
   * `listArticleVersions`. `upsert` keyed on the `@@unique([articleId,
   * locale])` constraint — calling this again for the same article/locale
   * pair replaces the existing translation wholesale (both `title`/`body`
   * are required on the DTO — see `SetArticleTranslationDto`'s own doc
   * comment), never merges partial fields.
   */
  async setArticleTranslation(
    id: string,
    locale: KbLocale,
    dto: SetArticleTranslationDto,
  ): Promise<ArticleTranslationSummary> {
    await this.findArticleInScope(id);
    return this.prisma.knowledgeBaseArticleTranslation.upsert({
      where: { articleId_locale: { articleId: id, locale } },
      create: { articleId: id, locale, title: dto.title, body: dto.body },
      update: { title: dto.title, body: dto.body },
    });
  }

  /** Story 109 — every translation currently set for this article, in no
   * particular order (there are at most two, one per `KbLocale`). Reuses
   * `findArticleInScope`'s existing branch-scope/404 guarantee. */
  async listArticleTranslations(id: string): Promise<ArticleTranslationSummary[]> {
    await this.findArticleInScope(id);
    return this.prisma.knowledgeBaseArticleTranslation.findMany({ where: { articleId: id } });
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
    query: ListArticlesQueryDto = {},
  ): Promise<Paginated<ArticleSummary>> {
    const search = query.search?.trim();
    if (search) {
      return this.applyLocaleToPage(
        await this.searchArticles(branchId, search, query, { publishedOnly: true }),
        query.locale,
      );
    }
    // Story S-8c — the `status: PUBLISHED` half of the scope is as much a
    // visibility rule as the branch is: a portal reader must never learn a
    // draft exists, including through `total`. Passing one `where` to
    // `paginate` is what guarantees the count and the page agree on it.
    const page = await paginate(this.prisma.knowledgeBaseArticle, {
      where: { branchId, status: "PUBLISHED" },
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      page: query.page,
      pageSize: query.pageSize,
    });
    return this.applyLocaleToPage(
      { ...page, items: page.items.map(toArticleSummary) },
      query.locale,
    );
  }

  /** 404s identically for a draft article, one in a different branch, or an
   * unknown id — a portal caller never learns a draft exists. */
  async getPublishedArticleForBranch(
    id: string,
    branchId: string,
    locale?: KbLocale,
  ): Promise<ArticleSummary> {
    const article = await this.prisma.knowledgeBaseArticle.findFirst({
      where: { id, branchId, status: "PUBLISHED" },
    });
    if (!article) {
      throw new NotFoundException("Article not found");
    }
    return this.applyLocaleToOne(toArticleSummary(article), locale);
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

  /**
   * Story 109 — resolves `locale` against `KnowledgeBaseArticleTranslation`
   * for every article in `articles`, in one batched query (never N+1). A
   * missing `locale`, an empty `articles` array, or no translation row for
   * a given article/locale pair all fall back to that article's own
   * unmodified `title`/`body` — the input array's own field values,
   * already whatever the caller's query resolved (base content or a
   * full-text search hit), passed straight through.
   */
  private async applyLocale(
    articles: ArticleSummary[],
    locale: KbLocale | undefined,
  ): Promise<ArticleSummary[]> {
    if (!locale || articles.length === 0) {
      return articles;
    }
    const translations = await this.prisma.knowledgeBaseArticleTranslation.findMany({
      where: { articleId: { in: articles.map((article) => article.id) }, locale },
    });
    const byArticleId = new Map(
      translations.map((translation) => [translation.articleId, translation]),
    );
    return articles.map((article) => {
      const translation = byArticleId.get(article.id);
      return translation
        ? { ...article, title: translation.title, body: translation.body }
        : article;
    });
  }

  /** Story 109 — the single-article counterpart to `applyLocale`, used by
   * `getArticle`/`getPublishedArticleForBranch`. `applyLocale` always
   * returns an array the same length as its input, so indexing `[0]` of a
   * one-element input is always defined — this just gives that guarantee
   * an actual `ArticleSummary` return type instead of an
   * `ArticleSummary | undefined` one callers would otherwise have to
   * needlessly narrow. */
  private async applyLocaleToOne(
    article: ArticleSummary,
    locale: KbLocale | undefined,
  ): Promise<ArticleSummary> {
    const [resolved] = await this.applyLocale([article], locale);
    return resolved ?? article;
  }

  /**
   * Story 102 — the actual full-text match, via `$queryRaw` (this
   * codebase's own existing, if singular, raw-SQL precedent —
   * `health.controller.ts`'s `$queryRaw\`SELECT 1\``). Prisma's typed
   * query builder has no operator for `tsvector`/`@@` matching (the
   * `fullTextSearch` preview feature is deliberately not enabled — see
   * this story's own plan doc), so the whole query, including the branch
   * scope and (for the portal caller) the published-only filter, runs as
   * one parameterized raw statement — never `$queryRawUnsafe`.
   *
   * `websearch_to_tsquery` (not `plainto_tsquery`/`to_tsquery`): the
   * standard choice for an unstructured, user-typed search box — handles
   * multi-word AND-by-default matching and quoted phrases, and never
   * throws on stray punctuation the way `to_tsquery`'s operator syntax
   * would. Ordered by `ts_rank` descending — the one deliberate behavior
   * upgrade over the old `contains` filter (which always ordered by
   * `updatedAt`/`publishedAt` regardless of match quality): a real
   * full-text search's core value is relevance ranking, and doing the
   * whole query in raw SQL costs no extra complexity over a two-step
   * id-then-refetch approach while actually preserving that order (a
   * Prisma `findMany({ where: { id: { in: [...] } } })` re-fetch would
   * not honor the original rank order).
   */
  /**
   * Story S-8c — the full-text path pages too, which `paginate` cannot do
   * for it: that helper drives a Prisma model delegate, and this is raw
   * SQL precisely because `ts_rank` ordering cannot be expressed through
   * the query builder (see this method's own doc comment above).
   *
   * So the two guarantees `paginate` provides are reproduced here by hand:
   *
   * - **One predicate.** The count and the page are issued from the same
   *   `publishedOnly` branch with the same interpolated `branchId`/
   *   `search`, so `total` can never be counted over a wider scope than
   *   `items` — which for the portal means never disclosing that drafts
   *   exist.
   * - **Deterministic order.** `ts_rank` ties constantly, far more than a
   *   timestamp does: any two articles matching the same single term
   *   usually score identically. Without `, id` a paged search would repeat
   *   and drop rows almost every time, so the tiebreaker matters more on
   *   this path than on either listing one.
   *
   * `COUNT(*)::int` rather than a bare `COUNT(*)`, which Postgres returns
   * as `bigint` and the driver hands back as a `BigInt` that `JSON.stringify`
   * refuses to serialise.
   */
  private async searchArticles(
    branchId: string,
    search: string,
    pagination: { page?: number; pageSize?: number } = {},
    options: { publishedOnly?: boolean } = {},
  ): Promise<Paginated<ArticleSummary>> {
    const page = pagination.page ?? 1;
    const pageSize = pagination.pageSize ?? DEFAULT_PAGE_SIZE;
    const offset = (page - 1) * pageSize;

    const [rows, countRows] = await Promise.all([
      options.publishedOnly
        ? this.prisma.$queryRaw<RawArticleRow[]>`
            SELECT id, branch_id AS "branchId", title, body, category, status,
                   published_at AS "publishedAt", created_at AS "createdAt",
                   updated_at AS "updatedAt"
            FROM knowledge_base.knowledge_base_articles
            WHERE branch_id = ${branchId}
              AND status = 'PUBLISHED'
              AND search_vector @@ websearch_to_tsquery('english', ${search})
            ORDER BY ts_rank(search_vector, websearch_to_tsquery('english', ${search})) DESC, id DESC
            LIMIT ${pageSize} OFFSET ${offset}
          `
        : this.prisma.$queryRaw<RawArticleRow[]>`
            SELECT id, branch_id AS "branchId", title, body, category, status,
                   published_at AS "publishedAt", created_at AS "createdAt",
                   updated_at AS "updatedAt"
            FROM knowledge_base.knowledge_base_articles
            WHERE branch_id = ${branchId}
              AND search_vector @@ websearch_to_tsquery('english', ${search})
            ORDER BY ts_rank(search_vector, websearch_to_tsquery('english', ${search})) DESC, id DESC
            LIMIT ${pageSize} OFFSET ${offset}
          `,
      options.publishedOnly
        ? this.prisma.$queryRaw<{ count: number }[]>`
            SELECT COUNT(*)::int AS count
            FROM knowledge_base.knowledge_base_articles
            WHERE branch_id = ${branchId}
              AND status = 'PUBLISHED'
              AND search_vector @@ websearch_to_tsquery('english', ${search})
          `
        : this.prisma.$queryRaw<{ count: number }[]>`
            SELECT COUNT(*)::int AS count
            FROM knowledge_base.knowledge_base_articles
            WHERE branch_id = ${branchId}
              AND search_vector @@ websearch_to_tsquery('english', ${search})
          `,
    ]);

    const total = countRows[0]?.count ?? 0;
    return {
      items: rows.map(toArticleSummary),
      total,
      page,
      pageSize,
      totalPages: totalPagesFor(total, pageSize),
    };
  }

  /** Story S-8c — `applyLocale` over a page's `items`, leaving the
   * pagination metadata untouched. Translation resolution is per-row and
   * never changes how many rows matched. */
  private async applyLocaleToPage(
    page: Paginated<ArticleSummary>,
    locale: KbLocale | undefined,
  ): Promise<Paginated<ArticleSummary>> {
    return { ...page, items: await this.applyLocale(page.items, locale) };
  }
}

/** The raw column shape `searchArticles`'s `$queryRaw` selects — matches
 * `toArticleSummary`'s existing input shape exactly. `status` arrives as a
 * plain string from `$queryRaw` (Postgres enums have no special client-side
 * type), safely narrowed since it always originates from this table's own
 * `KnowledgeBaseArticleStatus` column. */
interface RawArticleRow {
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
