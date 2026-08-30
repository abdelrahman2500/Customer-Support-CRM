import { useQuery } from "@tanstack/react-query";
import { getPublishedArticle, listPublishedArticles } from "@/lib/knowledge-base-api";

/** Story 54 — read-only: no mutation hooks exist (portal never authors KB content).
 *
 * Story 64 — `publishedArticlesQueryKey` becomes a function of `search`,
 * mirroring `apps/web`'s own `articlesQueryKey(search)` convention. */
export const publishedArticlesQueryKey = (search?: string) =>
  ["portal-knowledge-base-articles", search ?? ""] as const;
export const publishedArticleQueryKey = (id: string) =>
  ["portal-knowledge-base-articles", id] as const;

export function usePublishedArticlesQuery(search?: string) {
  return useQuery({
    queryKey: publishedArticlesQueryKey(search),
    queryFn: () => listPublishedArticles(search),
  });
}

export function usePublishedArticleQuery(id: string) {
  return useQuery({
    queryKey: publishedArticleQueryKey(id),
    queryFn: () => getPublishedArticle(id),
  });
}
