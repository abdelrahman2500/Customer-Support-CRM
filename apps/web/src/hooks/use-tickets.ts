import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getTicket,
  getTicketHistory,
  getTicketSlaTarget,
  listCustomers,
  listTickets,
  listUsers,
  updateTicket,
} from "@/lib/tickets-api";
import type { ListTicketsFilters, UpdateTicketInput } from "@/lib/tickets-api";

export const ticketsQueryKey = (filters: ListTicketsFilters) => ["tickets", filters] as const;
export const ticketQueryKey = (id: string) => ["ticket", id] as const;
export const ticketHistoryQueryKey = (id: string) => ["ticket", id, "history"] as const;
export const ticketSlaTargetQueryKey = (id: string) => ["ticket", id, "sla-target"] as const;

export function useTicketsQuery(filters: ListTicketsFilters) {
  return useQuery({
    queryKey: ticketsQueryKey(filters),
    queryFn: () => listTickets(filters),
  });
}

export function useTicketQuery(id: string) {
  return useQuery({ queryKey: ticketQueryKey(id), queryFn: () => getTicket(id) });
}

export function useTicketHistoryQuery(id: string) {
  return useQuery({ queryKey: ticketHistoryQueryKey(id), queryFn: () => getTicketHistory(id) });
}

export function useTicketSlaTargetQuery(id: string) {
  return useQuery({
    queryKey: ticketSlaTargetQueryKey(id),
    queryFn: () => getTicketSlaTarget(id),
  });
}

/** Long `staleTime`: a client-side name-resolution join over an
 * infrequently-changing list (Design item 9 of the plan) — not re-fetched
 * on every render. */
export function useCustomersQuery() {
  return useQuery({
    queryKey: ["customers"],
    queryFn: listCustomers,
    staleTime: 5 * 60_000,
  });
}

export function useUsersQuery() {
  return useQuery({ queryKey: ["users"], queryFn: listUsers, staleTime: 5 * 60_000 });
}

/**
 * Never applies the mutation optimistically (plan rule: "the frontend never
 * assumes an action will succeed," Design item 5) — the query cache is only
 * invalidated (forcing a re-fetch of the real, authoritative state) after
 * the real `PATCH /tickets/:id` response resolves successfully. A rejected
 * mutation leaves the cache untouched; the caller renders `mutation.error`.
 */
export function useUpdateTicketMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTicketInput) => updateTicket(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ticketQueryKey(id) });
      void queryClient.invalidateQueries({ queryKey: ticketHistoryQueryKey(id) });
      void queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}

/** Invalidates every query a live `ticket.updated`/`ticket.escalated` event
 * for this ticket could have changed — used by `useTicketRealtime`. */
export function invalidateTicketQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
): void {
  void queryClient.invalidateQueries({ queryKey: ticketQueryKey(id) });
  void queryClient.invalidateQueries({ queryKey: ticketHistoryQueryKey(id) });
  void queryClient.invalidateQueries({ queryKey: ticketSlaTargetQueryKey(id) });
  void queryClient.invalidateQueries({ queryKey: ["tickets"] });
}
