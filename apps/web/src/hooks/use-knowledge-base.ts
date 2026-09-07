import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createArticle,
  getArticle,
  listArticles,
  listArticleVersions,
  updateArticle,
} from "@/lib/knowledge-base-api";
import type { CreateArticleInput, UpdateArticleInput } from "@/lib/knowledge-base-api";
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
 */
export const articlesQueryKey = (search?: string, page?: number) =>
  ["knowledge-base-articles", search ?? "", page ?? 1] as const;
export const articleQueryKey = (id: string) => ["knowledge-base-articles", id] as const;

export function useArticlesQuery(search?: string, page?: number) {
  return useQuery({
    queryKey: articlesQueryKey(search, page),
    queryFn: () => listArticles({ search, page }),
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
