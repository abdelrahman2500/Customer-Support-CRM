import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createMyTicket,
  getMyTicket,
  getMyTicketCsat,
  getMyTicketHistory,
  getMyTicketMessages,
  listMyTickets,
  sendMyTicketMessage,
  submitMyTicketCsat,
} from "@/lib/tickets-api";
import { preservePreviousResults } from "@/lib/list-query";
import type {
  ChannelMessageSummary,
  CreateChannelMessageInput,
  CreatePortalTicketInput,
  SubmitCsatInput,
} from "@/lib/tickets-api";

/**
 * Story 53 — mirrors `apps/web/src/hooks/use-tickets.ts`'s never-optimistic
 * convention exactly: a mutation only ever invalidates the query cache on a
 * real, successful response — the UI always renders the re-fetched,
 * authoritative state, never an assumed one.
 *
 * PORTAL-1 — `myTicketsQueryKey` becomes a function of `page`, mirroring
 * `usePublishedArticlesQuery`'s own `publishedArticlesQueryKey(search, ...,
 * page)` convention: paging is a key change like any other, so it inherits
 * Story S-7's row preservation for free.
 */
export const myTicketsQueryKey = (page?: number) => ["portal-tickets", page ?? 1] as const;
export const myTicketQueryKey = (id: string) => ["portal-tickets", id] as const;
export const myTicketHistoryQueryKey = (id: string) => ["portal-tickets", id, "history"] as const;
export const myTicketCsatQueryKey = (id: string) => ["portal-tickets", id, "csat"] as const;

/** PORTAL-1 — 1-based; `undefined` until the reader pages, mirroring
 * `usePublishedArticlesQuery`'s own convention exactly. */
export function useMyTicketsQuery(page?: number) {
  return useQuery({
    queryKey: myTicketsQueryKey(page),
    queryFn: () => listMyTickets({ page }),
    ...preservePreviousResults,
  });
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
      // Broad `["portal-tickets"]`, not `myTicketsQueryKey()`: a new
      // ticket's page depends on how many the customer already has, so
      // every cached page is invalidated, mirroring `apps/web`'s own
      // `useCreateTicketMutation`'s `["tickets"]` precedent.
      void queryClient.invalidateQueries({ queryKey: ["portal-tickets"] });
    },
  });
}

export function useMyTicketCsatQuery(id: string) {
  return useQuery({ queryKey: myTicketCsatQueryKey(id), queryFn: () => getMyTicketCsat(id) });
}

export function useSubmitMyTicketCsatMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitCsatInput) => submitMyTicketCsat(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: myTicketCsatQueryKey(id) });
    },
  });
}

/** Story 78 — mirrors `apps/web/src/hooks/use-ticket-messages.ts`'s own
 * `mergeChannelMessage` exactly (own per-app copy, matching this file's
 * existing independent-re-declaration convention): appends unless a message
 * with the same `id` is already present, then keeps the list chronological.
 * Shared by the send-mutation's own `onSuccess` below and
 * `usePortalTicketRealtime`'s `channel.message.created` handler — the
 * contact's own sent message arrives back over the socket a moment after
 * the POST response already put it in the cache (Story 77 broadcasts to the
 * whole `ticket:{id}` room, sender included), so this is what keeps it from
 * appearing twice.
 *
 * RM-13 — now an upsert: mirrors `apps/web`'s own identical RM-13 change
 * exactly, including why (a status-update re-emission for a known id is a
 * real update to apply, not an echo to ignore — see that file's own doc
 * comment). */
export function mergeChannelMessage(
  existing: ChannelMessageSummary[] | undefined,
  incoming: ChannelMessageSummary,
): ChannelMessageSummary[] {
  const current = existing ?? [];
  const withoutIncoming = current.filter((message) => message.id !== incoming.id);
  return [...withoutIncoming, incoming].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export const myTicketMessagesQueryKey = (id: string) => ["portal-tickets", id, "messages"] as const;

export function useMyTicketMessagesQuery(id: string) {
  return useQuery({
    queryKey: myTicketMessagesQueryKey(id),
    queryFn: () => getMyTicketMessages(id),
  });
}

/** Merges the server's own returned message into the cache on success
 * (mirrors `apps/web`'s `useCreateTicketMessageMutation` exactly) instead of
 * invalidating: the contact needs their own sent message to appear
 * immediately, not after a full messages refetch. */
export function useSendMyTicketMessageMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateChannelMessageInput) => sendMyTicketMessage(id, input),
    onSuccess: (message) => {
      queryClient.setQueryData(
        myTicketMessagesQueryKey(id),
        (current: ChannelMessageSummary[] | undefined) => mergeChannelMessage(current, message),
      );
    },
  });
}
