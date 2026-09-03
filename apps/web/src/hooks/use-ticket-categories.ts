import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTicketCategory,
  listManagedTicketCategories,
  listTicketCategories,
  updateTicketCategory,
} from "@/lib/ticket-categories-api";
import type {
  CreateTicketCategoryInput,
  UpdateTicketCategoryInput,
} from "@/lib/ticket-categories-api";

/**
 * Story 120 — mirrors `use-branches.ts`'s department hooks exactly,
 * including the same "own query key, never optimistic" convention.
 * `["ticket-categories"]` (active-only, for pickers) is kept distinct from
 * `["managed-ticket-categories"]` (all, for the management screen) —
 * the same split `use-branches.ts` already established for
 * branches/departments.
 */
export const ticketCategoriesQueryKey = ["ticket-categories"] as const;
export const managedTicketCategoriesQueryKey = ["managed-ticket-categories"] as const;

/** Active-only — for a "pick a category" `<select>`. */
export function useTicketCategoriesQuery() {
  return useQuery({
    queryKey: ticketCategoriesQueryKey,
    queryFn: listTicketCategories,
  });
}

/** All (active + inactive) — for the management screen. */
export function useManagedTicketCategoriesQuery() {
  return useQuery({
    queryKey: managedTicketCategoriesQueryKey,
    queryFn: listManagedTicketCategories,
  });
}

/** Never applies optimistically — only a successful `POST
 * /ticket-categories` invalidates both query keys, forcing every consumer
 * (management screen and every picker) to re-fetch the real state. */
export function useCreateTicketCategoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTicketCategoryInput) => createTicketCategory(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: managedTicketCategoriesQueryKey });
      void queryClient.invalidateQueries({ queryKey: ticketCategoriesQueryKey });
    },
  });
}

/** Bound to one existing category's id — called once per row instance,
 * never inside a `.map()` (React's rules of hooks). */
export function useUpdateTicketCategoryMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTicketCategoryInput) => updateTicketCategory(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: managedTicketCategoriesQueryKey });
      void queryClient.invalidateQueries({ queryKey: ticketCategoriesQueryKey });
    },
  });
}
