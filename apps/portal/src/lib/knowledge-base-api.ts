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

export function listPublishedArticles(): Promise<PortalArticleSummary[]> {
  return apiFetch<PortalArticleSummary[]>("/portal/knowledge-base/articles");
}

export function getPublishedArticle(id: string): Promise<PortalArticleSummary> {
  return apiFetch<PortalArticleSummary>(`/portal/knowledge-base/articles/${id}`);
}
