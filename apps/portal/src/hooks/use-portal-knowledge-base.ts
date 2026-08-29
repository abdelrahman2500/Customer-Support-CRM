import { useQuery } from "@tanstack/react-query";
import { getPublishedArticle, listPublishedArticles } from "@/lib/knowledge-base-api";

/** Story 54 — read-only: no mutation hooks exist (portal never authors KB content). */
export const publishedArticlesQueryKey = ["portal-knowledge-base-articles"] as const;
export const publishedArticleQueryKey = (id: string) =>
  ["portal-knowledge-base-articles", id] as const;

export function usePublishedArticlesQuery() {
  return useQuery({ queryKey: publishedArticlesQueryKey, queryFn: listPublishedArticles });
}

export function usePublishedArticleQuery(id: string) {
  return useQuery({
    queryKey: publishedArticleQueryKey(id),
    queryFn: () => getPublishedArticle(id),
  });
}
