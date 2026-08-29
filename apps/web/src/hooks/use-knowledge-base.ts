import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createArticle,
  getArticle,
  listArticles,
  updateArticle,
} from "@/lib/knowledge-base-api";
import type { CreateArticleInput, UpdateArticleInput } from "@/lib/knowledge-base-api";

/**
 * Story 51 — dedicated Knowledge Base hooks (plan Design item 8), mirroring
 * `use-sla-policies.ts`'s never-optimistic convention exactly but living in
 * their own file — no import from `use-sla-policies.ts`/`use-tickets.ts`.
 */
export const articlesQueryKey = ["knowledge-base-articles"] as const;
export const articleQueryKey = (id: string) => ["knowledge-base-articles", id] as const;

export function useArticlesQuery() {
  return useQuery({
    queryKey: articlesQueryKey,
    queryFn: listArticles,
  });
}

export function useArticleQuery(id: string) {
  return useQuery({
    queryKey: articleQueryKey(id),
    queryFn: () => getArticle(id),
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
      void queryClient.invalidateQueries({ queryKey: articlesQueryKey });
    },
  });
}

/**
 * Never applies optimistically: only a successful `PATCH
 * /knowledge-base/articles/:id` invalidates both this one article's query
 * and the branch-wide list — a rejected mutation leaves the cache untouched
 * and the caller renders `mutation.error`.
 */
export function useUpdateArticleMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateArticleInput) => updateArticle(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: articleQueryKey(id) });
      void queryClient.invalidateQueries({ queryKey: articlesQueryKey });
    },
  });
}
