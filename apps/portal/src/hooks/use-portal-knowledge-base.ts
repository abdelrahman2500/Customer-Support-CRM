import { useQuery } from "@tanstack/react-query";
import { getPublishedArticle, listPublishedArticles } from "@/lib/knowledge-base-api";
import { preservePreviousResults } from "@/lib/list-query";
import type { KbLocale } from "@/lib/knowledge-base-api";

/** Story 54 — read-only: no mutation hooks exist (portal never authors KB content).
 *
 * Story 64 — `publishedArticlesQueryKey` becomes a function of `search`,
 * mirroring `apps/web`'s own `articlesQueryKey(search)` convention.
 *
 * Story 109 — both query keys also include `locale`, so switching the
 * portal's own active locale never serves a stale cached response fetched
 * under the other one. */
/** Story S-8c — the requested page joins the key, so paging behaves like
 * any other key change and inherits Story S-7's row preservation. */
export const publishedArticlesQueryKey = (search?: string, locale?: KbLocale, page?: number) =>
  ["portal-knowledge-base-articles", search ?? "", locale ?? "", page ?? 1] as const;
export const publishedArticleQueryKey = (id: string, locale?: KbLocale) =>
  ["portal-knowledge-base-articles", id, locale ?? ""] as const;

export function usePublishedArticlesQuery(search?: string, locale?: KbLocale, page?: number) {
  return useQuery({
    queryKey: publishedArticlesQueryKey(search, locale, page),
    queryFn: () => listPublishedArticles(search, locale, { page }),
    // Story S-7 — `search`/`locale` are the key, so both are new queries,
    // and since Story S-8c so is the page.
    ...preservePreviousResults,
  });
}

export function usePublishedArticleQuery(id: string, locale?: KbLocale) {
  return useQuery({
    queryKey: publishedArticleQueryKey(id, locale),
    queryFn: () => getPublishedArticle(id, locale),
  });
}
