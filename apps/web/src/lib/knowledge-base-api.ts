import { apiFetch } from "./api";
import type { PaginatedResponse } from "./paginated";

/**
 * Story 51 — Knowledge Base Foundation. A dedicated API client file (plan
 * Design item 8), mirroring `sla-policies-api.ts`'s own precedent: a
 * distinct domain with no forcing reason to share a file with
 * `tickets-api.ts`.
 */
export type ArticleStatus = "DRAFT" | "PUBLISHED";

/** Mirrors the backend's own `ArticleSummary` exactly
 * (`apps/api/src/modules/knowledge-base/knowledge-base.service.ts`).
 *
 * RM-27 — `category` (free text) replaced by `categoryId`/`categoryName`,
 * mirroring `tickets-api.ts`'s own `TicketSummary` schema change. */
export interface ArticleSummary {
  id: string;
  branchId: string;
  title: string;
  body: string;
  categoryId: string | null;
  categoryName: string | null;
  status: ArticleStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Story 149 — mirrors the backend's own `ArticleListItem`: what
 * `GET /knowledge-base/articles` returns, as opposed to what
 * `GET /knowledge-base/articles/:id` returns.
 *
 * Kept distinct from `ArticleSummary` for the same reason the backend
 * keeps them distinct — `getArticle` does not carry this field, and typing
 * it as though it did would let a detail screen read `undefined` as
 * "untranslated".
 */
export interface ArticleListItem extends ArticleSummary {
  /** Whether the article has an Arabic (`AR`) translation. English is the
   * base article's own content, so this is the only translation there is
   * to be missing. */
  hasArabicTranslation: boolean;
}

/** Mirrors the existing `CreateArticleDto` exactly (`apps/api/src/modules/knowledge-base/dto/create-article.dto.ts`). */
export interface CreateArticleInput {
  title: string;
  body: string;
  categoryId?: string;
}

/** Mirrors the existing `UpdateArticleDto` exactly (`apps/api/src/modules/knowledge-base/dto/update-article.dto.ts`). */
export interface UpdateArticleInput {
  title?: string;
  body?: string;
  categoryId?: string;
  status?: ArticleStatus;
}

/** Story 64 — Article Search. Mirrors `tickets-api.ts`'s own
 * `toQueryString` convention: an omitted/empty `search` produces the exact
 * same request every existing caller already sends. */
/**
 * Story S-8c — the article list's request parameters. `search` keeps its
 * Story 64 semantics exactly; `page`/`pageSize` are new and optional, so
 * omitting them reproduces the pre-S-8c request apart from the page bound
 * the API now applies by default.
 */
/** RM-05 — additive filter, only ever set to `"PUBLISHED"` by the ticket
 * workspace's own KB reference search widget (`ticket-kb-references-api.ts`)
 * so it never offers a draft as a reference candidate. */
/** RM-27 — additive exact-id filter, mirroring `ListArticlesQueryDto
 * .categoryId`'s own schema change from a free-text `category` filter. */
export interface ArticleFilters {
  search?: string;
  status?: ArticleStatus;
  categoryId?: string;
  page?: number;
  pageSize?: number;
}

function toQueryString(filters: ArticleFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function listArticles(
  filters: ArticleFilters = {},
): Promise<PaginatedResponse<ArticleListItem>> {
  return apiFetch<PaginatedResponse<ArticleListItem>>(
    `/knowledge-base/articles${toQueryString(filters)}`,
  );
}

export function getArticle(id: string): Promise<ArticleSummary> {
  return apiFetch<ArticleSummary>(`/knowledge-base/articles/${id}`);
}

export function createArticle(input: CreateArticleInput): Promise<ArticleSummary> {
  return apiFetch<ArticleSummary>("/knowledge-base/articles", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateArticle(id: string, input: UpdateArticleInput): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/knowledge-base/articles/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/** Story 65 — Article Version History. Mirrors the backend's own
 * `ArticleVersionSummary` exactly
 * (`apps/api/src/modules/knowledge-base/knowledge-base.service.ts`). */
export interface ArticleVersionSummary {
  id: string;
  articleId: string;
  versionNumber: number;
  title: string;
  body: string;
  category: string | null;
  publishedAt: string;
  createdAt: string;
}

export function listArticleVersions(articleId: string): Promise<ArticleVersionSummary[]> {
  return apiFetch<ArticleVersionSummary[]>(`/knowledge-base/articles/${articleId}/versions`);
}

/** Story 109 — the locales an article's content can carry. Mirrors the
 * backend's own `KbLocale` Prisma enum exactly; the API expects the
 * upper-case form in the route segment. */
export type ArticleLocale = "EN" | "AR";

/** Story 109 — one article's content in one locale. Mirrors the backend's
 * own `ArticleTranslationSummary` exactly
 * (`apps/api/src/modules/knowledge-base/knowledge-base.service.ts`).
 *
 * `createdAt`/`updatedAt` are `string` rather than `Date`: the backend
 * types them as `Date`, but they cross the wire as JSON, and every other
 * interface in this file (`ArticleSummary`, `ArticleVersionSummary`)
 * already models a timestamp as `string`. */
export interface ArticleTranslationSummary {
  id: string;
  articleId: string;
  locale: ArticleLocale;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

/** Mirrors `SetArticleTranslationDto` exactly: both fields required, both
 * non-empty (`@IsString() @MinLength(1)`). `locale` is a route segment,
 * never part of the body. */
export interface SetArticleTranslationInput {
  title: string;
  body: string;
}

export function listArticleTranslations(articleId: string): Promise<ArticleTranslationSummary[]> {
  return apiFetch<ArticleTranslationSummary[]>(
    `/knowledge-base/articles/${articleId}/translations`,
  );
}

/** Story 109 — a wholesale replace (the backend upserts on
 * `(articleId, locale)`), never a merge, which is why both fields are
 * required here. */
export function setArticleTranslation(
  articleId: string,
  locale: ArticleLocale,
  input: SetArticleTranslationInput,
): Promise<ArticleTranslationSummary> {
  return apiFetch<ArticleTranslationSummary>(
    `/knowledge-base/articles/${articleId}/translations/${locale}`,
    { method: "PUT", body: JSON.stringify(input) },
  );
}
