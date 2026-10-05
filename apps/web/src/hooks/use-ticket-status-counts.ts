import { useQueries } from "@tanstack/react-query";
import { listTickets, type TicketStatus } from "@/lib/tickets-api";

export const COUNTED_STATUSES: readonly TicketStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
];

/**
 * Story 221 (PR-3.6) — how many tickets the agent can see in each status,
 * for the dashboard's distribution bar. One `pageSize: 1` list request per
 * status: the envelope's `total` respects branch and department visibility,
 * which `/reports/ticket-volume` (needs `report:read`) would not give an
 * agent. Keys sit under `["tickets"]`, so any ticket change refreshes them.
 */
export function useTicketStatusCounts(): {
  counts: Partial<Record<TicketStatus, number>>;
  isLoading: boolean;
  isError: boolean;
} {
  const results = useQueries({
    queries: COUNTED_STATUSES.map((status) => ({
      queryKey: ["tickets", "status-count", status] as const,
      queryFn: () => listTickets({ status, pageSize: 1 }),
    })),
  });
  const counts: Partial<Record<TicketStatus, number>> = {};
  COUNTED_STATUSES.forEach((status, index) => {
    const total = results[index]?.data?.total;
    if (total !== undefined) counts[status] = total;
  });
  return {
    counts,
    isLoading: results.some((result) => result.isLoading),
    isError: results.some((result) => result.isError),
  };
}
