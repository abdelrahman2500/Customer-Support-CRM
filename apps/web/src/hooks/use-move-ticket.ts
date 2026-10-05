import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { updateTicket, type TicketListItem, type TicketStatus } from "@/lib/tickets-api";
import { ticketHistoryQueryKey, ticketQueryKey } from "@/hooks/use-tickets";
import {
  insertIntoPages,
  removeFromPages,
  type ColumnPages,
} from "@/components/tickets/board/board-moves";
import type { BoardFilters } from "@/components/tickets/board/board-state";

export interface MoveTicketInput {
  ticket: TicketListItem;
  to: TicketStatus;
}

const BOARD_KEY = ["tickets", "board"] as const;

/**
 * Story 217 (PR-3.2, tickets-kanban-ux.md §5 "Data flow") — moves a ticket
 * to another status with the existing `PATCH /tickets/:id { status }`.
 *
 * - `onMutate`: cancels the board's column queries, snapshots them, takes the
 *   card out of its source column and puts it into the target column at its
 *   sorted position, adjusting both totals — so the move is instant.
 * - `onError`: restores the snapshots; a 404 also drops the card (the ticket
 *   is gone). The caller turns the error into copy and an announcement.
 * - `onSettled`: invalidates every ticket list (board, list view,
 *   dashboard) and the ticket itself, so the server's order wins.
 */
export function useMoveTicketMutation() {
  const queryClient = useQueryClient();

  const removeEverywhere = (ticketId: string) => {
    for (const [key, data] of queryClient.getQueriesData<ColumnPages>({ queryKey: BOARD_KEY })) {
      if (data) queryClient.setQueryData(key, removeFromPages(data, ticketId));
    }
  };

  return useMutation({
    mutationFn: ({ ticket, to }: MoveTicketInput) => updateTicket(ticket.id, { status: to }),
    onMutate: async ({ ticket, to }) => {
      await queryClient.cancelQueries({ queryKey: BOARD_KEY });
      const snapshots = queryClient.getQueriesData<ColumnPages>({ queryKey: BOARD_KEY });
      const moved: TicketListItem = { ...ticket, status: to, updatedAt: new Date().toISOString() };
      for (const [key, data] of snapshots) {
        if (!data) continue;
        const status = key[2] as TicketStatus;
        const filters = key[3] as Omit<BoardFilters, "risk">;
        if (status === ticket.status) {
          queryClient.setQueryData(key, removeFromPages(data, ticket.id));
        } else if (status === to) {
          queryClient.setQueryData(key, insertIntoPages(data, moved, filters.sort));
        }
      }
      return { snapshots };
    },
    onError: (error, { ticket }, context) => {
      for (const [key, data] of context?.snapshots ?? ([] as [QueryKey, ColumnPages][])) {
        queryClient.setQueryData(key, data);
      }
      if (error instanceof ApiError && error.status === 404) removeEverywhere(ticket.id);
    },
    onSettled: (_data, _error, { ticket }) => {
      void queryClient.invalidateQueries({ queryKey: ["tickets"] });
      void queryClient.invalidateQueries({ queryKey: ticketQueryKey(ticket.id) });
      void queryClient.invalidateQueries({ queryKey: ticketHistoryQueryKey(ticket.id) });
    },
  });
}
