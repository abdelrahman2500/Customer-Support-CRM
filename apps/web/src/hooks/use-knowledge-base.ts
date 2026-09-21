import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createArticle,
  getArticle,
  listArticles,
  listArticleTranslations,
  listArticleVersions,
  setArticleTranslation,
  updateArticle,
} from "@/lib/knowledge-base-api";
import type {
  ArticleLocale,
  CreateArticleInput,
  SetArticleTranslationInput,
  UpdateArticleInput,
} from "@/lib/knowledge-base-api";
import { preservePreviousResults } from "@/lib/list-query";

/**
 * Story 51 — dedicated Knowledge Base hooks (plan Design item 8), mirroring
 * `use-sla-policies.ts`'s never-optimistic convention exactly but living in
 * their own file — no import from `use-sla-policies.ts`/`use-tickets.ts`.
 *
 * Story 64 — `articlesQueryKey` becomes a function of `search`, mirroring
 * `ticketsQueryKey`'s own filters-as-key-function convention; mutations
 * still invalidate the bare `["knowledge-base-articles"]` prefix, which
 * matches every search variant (same partial-match convention `use-tickets.ts`
 * relies on for `["tickets"]`).
 */
/**
 * Story S-8c — the key carries the page alongside the search term, so a
 * page change is a new query exactly like a keystroke is, and inherits
 * Story S-7's row preservation.
 *
 * `page` is appended rather than folded into the existing element so the
 * key's shape stays greppable, and so mutations that invalidate the bare
 * `["knowledge-base-articles"]` prefix keep matching every page - which is
 * how publishing an article still refreshes the list.
 *
 * Batch 4 (UX audit) — `categoryId` appended the same way: the backend's
 * `ListArticlesQueryDto.categoryId` (RM-27) was already a real, working
 * filter with no frontend caller for it on this list.
 */
export const articlesQueryKey = (search?: string, page?: number, categoryId?: string) =>
  ["knowledge-base-articles", search ?? "", page ?? 1, categoryId ?? ""] as const;
export const articleQueryKey = (id: string) => ["knowledge-base-articles", id] as const;

export function useArticlesQuery(search?: string, page?: number, categoryId?: string) {
  return useQuery({
    queryKey: articlesQueryKey(search, page, categoryId),
    queryFn: () => listArticles({ search, page, categoryId }),
    // Story S-7 — `search` is the key, so typing is a new query, and since
    // Story S-8c so is a page change. Keep the previous results visible
    // while the new ones load.
    ...preservePreviousResults,
  });
}

/** RM-05 — the ticket workspace's own KB reference search widget: only
 * ever searches (never browses the whole branch), and only ever
 * `PUBLISHED` articles (so an agent is never offered a draft to reference —
 * `TicketKbReferencesController` separately re-validates this server-side
 * regardless). A distinct query key/`enabled` gate from `useArticlesQuery`
 * above (not a parameter on it) since its own empty-search behavior
 * (return nothing, not "the branch's newest articles") is deliberately
 * different. */
export const publishedArticleSearchQueryKey = (search: string) =>
  ["knowledge-base-articles", "published-search", search] as const;

export function usePublishedArticleSearchQuery(search: string) {
  const trimmed = search.trim();
  return useQuery({
    queryKey: publishedArticleSearchQueryKey(trimmed),
    queryFn: () => listArticles({ search: trimmed, status: "PUBLISHED", pageSize: 5 }),
    enabled: trimmed.length > 0,
  });
}

export function useArticleQuery(id: string) {
  return useQuery({
    queryKey: articleQueryKey(id),
    queryFn: () => getArticle(id),
  });
}

/** Story 65 — Article Version History. */
export const articleVersionsQueryKey = (articleId: string) =>
  ["knowledge-base-article-versions", articleId] as const;

export function useArticleVersionsQuery(articleId: string) {
  return useQuery({
    queryKey: articleVersionsQueryKey(articleId),
    queryFn: () => listArticleVersions(articleId),
  });
}

/** Story 137 — a separate root key, mirroring `articleVersionsQueryKey`'s
 * own precedent above. Nesting this under `["knowledge-base-articles", ...]`
 * would make every unrelated article mutation invalidate it through the
 * bare-prefix invalidation `useUpdateArticleMutation` performs. */
export const articleTranslationsQueryKey = (articleId: string) =>
  ["knowledge-base-article-translations", articleId] as const;

export function useArticleTranslationsQuery(articleId: string) {
  return useQuery({
    queryKey: articleTranslationsQueryKey(articleId),
    queryFn: () => listArticleTranslations(articleId),
  });
}

/**
 * Story 137 — never applies optimistically (the rule every other mutation
 * hook in this file follows). Invalidates **only** the translations query:
 * a translation is a separate row and changes nothing about the base
 * article's own `title`/`body`/`status`, so invalidating `articleQueryKey`
 * or the `["knowledge-base-articles"]` list prefix would re-fetch content
 * this mutation cannot have altered.
 */
export function useSetArticleTranslationMutation(articleId: string, locale: ArticleLocale) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SetArticleTranslationInput) =>
      setArticleTranslation(articleId, locale, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: articleTranslationsQueryKey(articleId) });
    },
  });
}

/**
 * Never applies optimistically (same rule every other mutation hook in this
 * codebase follows): only a successful `POST /knowledge-base/articles`
 * invalidates the list, forcing it to re-fetch the real, authoritative state.
 */
export function useCreateArticleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateArticleInput) => createArticle(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["knowledge-base-articles"] });
    },
  });
}

/**
 * Never applies optimistically: only a successful `PATCH
 * /knowledge-base/articles/:id` invalidates this one article's query, the
 * branch-wide list, and its version history (Story 65 — a publish may have
 * just created a new version; invalidating unconditionally is simpler and
 * no more costly than checking `input.status` first) — a rejected mutation
 * leaves the cache untouched and the caller renders `mutation.error`.
 */
export function useUpdateArticleMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateArticleInput) => updateArticle(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: articleQueryKey(id) });
      void queryClient.invalidateQueries({ queryKey: ["knowledge-base-articles"] });
      void queryClient.invalidateQueries({ queryKey: articleVersionsQueryKey(id) });
    },
  });
}
