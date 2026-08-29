import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createMyTicket,
  getMyTicket,
  getMyTicketHistory,
  listMyTickets,
} from "@/lib/tickets-api";
import type { CreatePortalTicketInput } from "@/lib/tickets-api";

/**
 * Story 53 — mirrors `apps/web/src/hooks/use-tickets.ts`'s never-optimistic
 * convention exactly: a mutation only ever invalidates the query cache on a
 * real, successful response — the UI always renders the re-fetched,
 * authoritative state, never an assumed one.
 */
export const myTicketsQueryKey = ["portal-tickets"] as const;
export const myTicketQueryKey = (id: string) => ["portal-tickets", id] as const;
export const myTicketHistoryQueryKey = (id: string) => ["portal-tickets", id, "history"] as const;

export function useMyTicketsQuery() {
  return useQuery({ queryKey: myTicketsQueryKey, queryFn: listMyTickets });
}

export function useMyTicketQuery(id: string) {
  return useQuery({ queryKey: myTicketQueryKey(id), queryFn: () => getMyTicket(id) });
}

export function useMyTicketHistoryQuery(id: string) {
  return useQuery({
    queryKey: myTicketHistoryQueryKey(id),
    queryFn: () => getMyTicketHistory(id),
  });
}

export function useCreateMyTicketMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePortalTicketInput) => createMyTicket(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: myTicketsQueryKey });
    },
  });
}
