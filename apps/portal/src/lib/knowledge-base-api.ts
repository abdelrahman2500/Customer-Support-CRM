import { apiFetch } from "./api";

/**
 * Story 54 — Customer Portal — Knowledge Base Browsing. Mirrors the
 * backend's `ArticleSummary` exactly
 * (`apps/api/src/modules/knowledge-base/knowledge-base.service.ts`) — every
 * article returned here is guaranteed `status: "PUBLISHED"`.
 */
export interface PortalArticleSummary {
  id: string;
  branchId: string;
  title: string;
  body: string;
  category: string | null;
  status: "PUBLISHED";
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
}

/** Story 64 — Article Search. Mirrors `apps/web`'s own `toQueryString`
 * convention: an omitted/empty `search` produces the exact same request
 * every existing caller already sends. */
function toQueryString(search: string | undefined): string {
  const params = new URLSearchParams();
  if (search !== undefined && search !== "") {
    params.set("search", search);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function listPublishedArticles(search?: string): Promise<PortalArticleSummary[]> {
  return apiFetch<PortalArticleSummary[]>(`/portal/knowledge-base/articles${toQueryString(search)}`);
}

export function getPublishedArticle(id: string): Promise<PortalArticleSummary> {
  return apiFetch<PortalArticleSummary>(`/portal/knowledge-base/articles/${id}`);
}
