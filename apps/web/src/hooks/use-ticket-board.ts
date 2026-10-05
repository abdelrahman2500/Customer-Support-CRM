import { useInfiniteQuery } from "@tanstack/react-query";
import { listTickets, type TicketStatus } from "@/lib/tickets-api";
import { columnQuery, type BoardFilters } from "@/components/tickets/board/board-state";

/**
 * Story 216 (PR-3.1) — one board column: its status under the shared filters,
 * 25 cards a page, "Show more" loading the next page (tickets-kanban-ux.md
 * §3). The key sits under `["tickets"]`, so every existing invalidation of
 * the ticket lists (a status change, an assignment) refreshes the board too.
 * The server filters drive the key; the client-side "at risk" scope does not
 * refetch.
 */
export function ticketBoardColumnQueryKey(status: TicketStatus, filters: BoardFilters) {
  const { risk: _risk, ...server } = filters;
  void _risk;
  return ["tickets", "board", status, server] as const;
}

export function useTicketBoardColumnQuery(status: TicketStatus, filters: BoardFilters) {
  return useInfiniteQuery({
    queryKey: ticketBoardColumnQueryKey(status, filters),
    queryFn: ({ pageParam }) => listTickets({ ...columnQuery(status, filters), page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
}
