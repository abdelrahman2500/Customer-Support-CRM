import { useInfiniteQuery, useIsMutating } from "@tanstack/react-query";
import { listTickets, type TicketStatus } from "@/lib/tickets-api";
import { columnQuery, type BoardFilters } from "@/components/tickets/board/board-state";
import { MOVE_TICKET_MUTATION_KEY } from "@/hooks/use-move-ticket";

/** Story 218 (PR-3.3, PD-4 deferred) — how often a visible board refetches. */
export const BOARD_REFRESH_MS = 30_000;

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

/**
 * Story 218 (PR-3.3, tickets-kanban-ux.md §6) — with no realtime broadcast
 * (PD-4 deferred), the board stays fresh by refetching: every 30s while the
 * tab is visible (never in the background) and when the window regains
 * focus. A refetch reloads every loaded page, so "Show more" survives it.
 * Nothing refetches while a card is being dragged (`paused`) or a move is
 * saving, so a refetch never yanks a card from under the agent.
 */
export function useTicketBoardColumnQuery(
  status: TicketStatus,
  filters: BoardFilters,
  { paused = false }: { paused?: boolean } = {},
) {
  const saving = useIsMutating({ mutationKey: MOVE_TICKET_MUTATION_KEY }) > 0;
  const hold = paused || saving;
  return useInfiniteQuery({
    queryKey: ticketBoardColumnQueryKey(status, filters),
    queryFn: ({ pageParam }) => listTickets({ ...columnQuery(status, filters), page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    refetchInterval: hold ? false : BOARD_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: !hold,
  });
}
