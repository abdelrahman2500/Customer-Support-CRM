import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createTicketMessage, getTicketMessages } from "@/lib/ticket-messages-api";
import type { ChannelMessageSummary, CreateChannelMessageInput } from "@/lib/ticket-messages-api";

export const ticketMessagesQueryKey = (id: string) => ["ticket", id, "messages"] as const;

/**
 * Story 78 — appends `incoming` to `existing` unless a message with the same
 * `id` is already present, then keeps the list chronological (re-sorting
 * defensively in case of any out-of-order delivery). Shared by the
 * send-mutation's own `onSuccess` below and `useTicketRealtime`'s
 * `channel.message.created` handler: Story 77's realtime event broadcasts to
 * the *whole* `ticket:{id}` room, sender included, so the sender's own sent
 * message arrives back over the socket a moment after the POST response
 * already put it in the cache — this is what keeps it from appearing twice.
 *
 * RM-13 — now an upsert: an existing `id` is *replaced* rather than
 * ignored. `ChannelMessagesService.markSent`/`markDelivered`/`markFailed`
 * re-emit `channel.message.created` for an already-created message once
 * its delivery status changes (deliberately reusing the same event rather
 * than adding a new one — see that service's own doc comment), so a
 * second arrival for a known id is a real, meaningful update, not an echo
 * to ignore. Every pre-existing call site only ever re-sends identical
 * content for an id it already had (the sender's own broadcast echo), so
 * this changes nothing observable for any flow that predates this story.
 */
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

/** No `staleTime`, mirrors `useTicketNotesQuery`/`useTicketHistoryQuery`:
 * per-ticket event data, kept live by `useTicketRealtime` rather than
 * time-based refetching. */
export function useTicketMessagesQuery(id: string) {
  return useQuery({ queryKey: ticketMessagesQueryKey(id), queryFn: () => getTicketMessages(id) });
}

/**
 * Unlike every other mutation in `use-tickets.ts`, a successful send merges
 * the server's own returned message directly into the cache via
 * `mergeChannelMessage` instead of invalidating: a chat composer needs the
 * message the agent just sent to appear immediately, not after a full
 * ticket-messages refetch. This still never assumes success before the real
 * response arrives (Design item 5's rule, unchanged) — it merges the
 * server's own returned `ChannelMessageSummary`, not a locally-guessed one.
 */
export function useCreateTicketMessageMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateChannelMessageInput) => createTicketMessage(id, input),
    onSuccess: (message) => {
      queryClient.setQueryData(
        ticketMessagesQueryKey(id),
        (current: ChannelMessageSummary[] | undefined) => mergeChannelMessage(current, message),
      );
    },
  });
}
