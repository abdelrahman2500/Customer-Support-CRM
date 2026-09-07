import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createKbCategory,
  listKbCategories,
  listManagedKbCategories,
  updateKbCategory,
} from "@/lib/kb-categories-api";
import type { CreateKbCategoryInput, UpdateKbCategoryInput } from "@/lib/kb-categories-api";

/**
 * RM-27 — mirrors `use-ticket-categories.ts`'s hooks exactly, including the
 * same "own query key, never optimistic" convention. `["kb-categories"]`
 * (active-only, for pickers) is kept distinct from
 * `["managed-kb-categories"]` (all, for the management screen) — the same
 * split `use-ticket-categories.ts` already established.
 */
export const kbCategoriesQueryKey = ["kb-categories"] as const;
export const managedKbCategoriesQueryKey = ["managed-kb-categories"] as const;

/** Active-only — for a "pick a category" `<select>`. */
export function useKbCategoriesQuery() {
  return useQuery({
    queryKey: kbCategoriesQueryKey,
    queryFn: listKbCategories,
  });
}

/** All (active + inactive) — for the management screen. */
export function useManagedKbCategoriesQuery() {
  return useQuery({
    queryKey: managedKbCategoriesQueryKey,
    queryFn: listManagedKbCategories,
  });
}

/** Never applies optimistically — only a successful `POST /kb-categories`
 * invalidates both query keys, forcing every consumer (management screen
 * and every picker) to re-fetch the real state. */
export function useCreateKbCategoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateKbCategoryInput) => createKbCategory(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: managedKbCategoriesQueryKey });
      void queryClient.invalidateQueries({ queryKey: kbCategoriesQueryKey });
    },
  });
}

/** Bound to one existing category's id — called once per row instance,
 * never inside a `.map()` (React's rules of hooks). */
export function useUpdateKbCategoryMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateKbCategoryInput) => updateKbCategory(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: managedKbCategoriesQueryKey });
      void queryClient.invalidateQueries({ queryKey: kbCategoriesQueryKey });
    },
  });
}
