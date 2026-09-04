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
export const articlesQueryKey = (search?: string) =>
  ["knowledge-base-articles", search ?? ""] as const;
export const articleQueryKey = (id: string) => ["knowledge-base-articles", id] as const;

export function useArticlesQuery(search?: string) {
  return useQuery({
    queryKey: articlesQueryKey(search),
    queryFn: () => listArticles(search),
    // Story S-7 — `search` is the key, so typing is a new query. Keep the
    // previous results visible while the new ones load.
    ...preservePreviousResults,
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
