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
 * (`apps/api/src/modules/knowledge-base/knowledge-base.service.ts`). */
export interface ArticleSummary {
  id: string;
  branchId: string;
  title: string;
  body: string;
  category: string | null;
  status: ArticleStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Mirrors the existing `CreateArticleDto` exactly (`apps/api/src/modules/knowledge-base/dto/create-article.dto.ts`). */
export interface CreateArticleInput {
  title: string;
  body: string;
  category?: string;
}

/** Mirrors the existing `UpdateArticleDto` exactly (`apps/api/src/modules/knowledge-base/dto/update-article.dto.ts`). */
export interface UpdateArticleInput {
  title?: string;
  body?: string;
  category?: string;
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
export interface ArticleFilters {
  search?: string;
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
): Promise<PaginatedResponse<ArticleSummary>> {
  return apiFetch<PaginatedResponse<ArticleSummary>>(
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
