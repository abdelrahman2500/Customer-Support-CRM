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

/** Story 109 — matches the backend's `KbLocale` enum exactly. */
export type KbLocale = "EN" | "AR";

/** Story 64 — Article Search. Mirrors `apps/web`'s own `toQueryString`
 * convention: an omitted/empty `search` produces the exact same request
 * every existing caller already sends.
 *
 * Story 109 — `locale` added the same way: omitted entirely when absent,
 * so a caller that never passes one keeps sending the exact same request
 * as before this story. */
function toQueryString(search: string | undefined, locale?: KbLocale): string {
  const params = new URLSearchParams();
  if (search !== undefined && search !== "") {
    params.set("search", search);
  }
  if (locale !== undefined) {
    params.set("locale", locale);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function listPublishedArticles(
  search?: string,
  locale?: KbLocale,
): Promise<PortalArticleSummary[]> {
  return apiFetch<PortalArticleSummary[]>(
    `/portal/knowledge-base/articles${toQueryString(search, locale)}`,
  );
}

export function getPublishedArticle(id: string, locale?: KbLocale): Promise<PortalArticleSummary> {
  return apiFetch<PortalArticleSummary>(
    `/portal/knowledge-base/articles/${id}${toQueryString(undefined, locale)}`,
  );
}
