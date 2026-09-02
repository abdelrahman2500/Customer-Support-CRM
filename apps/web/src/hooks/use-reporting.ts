import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateDashboardInput,
  ReportDateRange,
  UpdateDashboardInput,
} from "@/lib/reporting-api";
import {
  createDashboard,
  deleteDashboard,
  getAgentPerformance,
  getCsatSummary,
  getDashboard,
  getResolutionTime,
  getSlaCompliance,
  getTicketAging,
  getTicketVolumeByStatus,
  listDashboards,
  updateDashboard,
} from "@/lib/reporting-api";

/**
 * Story 56 — dedicated reporting hooks, mirroring `use-audit-logs.ts`'s "own
 * file, no import from `use-tickets.ts`" convention. Read-only — no
 * mutation exists on this screen. No `staleTime` override: mirrors
 * `useAuditLogsQuery`'s always-fresh default, since these aggregates change
 * whenever a ticket/SLA/CSAT event happens elsewhere.
 *
 * Story 93 — each hook gains an optional `range` parameter, included in its
 * query key so a range change refetches (and caches independently from)
 * the all-time query — the same parameterized-query-key pattern
 * `useTicketsQuery(filters)` already established. Omitting `range` (an
 * empty `{}`, ReportsView's own default) reproduces each hook's exact
 * pre-Story-93 behavior.
 */
export function useTicketVolumeQuery(range: ReportDateRange = {}) {
  return useQuery({
    queryKey: ["reports", "ticket-volume", range],
    queryFn: () => getTicketVolumeByStatus(range),
  });
}

export function useSlaComplianceQuery(range: ReportDateRange = {}) {
  return useQuery({
    queryKey: ["reports", "sla-compliance", range],
    queryFn: () => getSlaCompliance(range),
  });
}

export function useCsatSummaryQuery(range: ReportDateRange = {}) {
  return useQuery({ queryKey: ["reports", "csat", range], queryFn: () => getCsatSummary(range) });
}

export function useAgentPerformanceQuery(range: ReportDateRange = {}) {
  return useQuery({
    queryKey: ["reports", "agent-performance", range],
    queryFn: () => getAgentPerformance(range),
  });
}

export function useTicketAgingQuery(range: ReportDateRange = {}) {
  return useQuery({
    queryKey: ["reports", "ticket-aging", range],
    queryFn: () => getTicketAging(range),
  });
}

/** Story 99 — same parameterized-query-key pattern as every other hook here. */
export function useResolutionTimeQuery(range: ReportDateRange = {}) {
  return useQuery({
    queryKey: ["reports", "resolution-time", range],
    queryFn: () => getResolutionTime(range),
  });
}

/**
 * Story 110 — Saved Dashboards. Mirrors `use-quick-replies.ts`'s
 * never-optimistic, invalidate-on-success mutation convention exactly.
 */
export const dashboardsQueryKey = ["reports", "dashboards"] as const;

export function useDashboardsQuery() {
  return useQuery({ queryKey: dashboardsQueryKey, queryFn: listDashboards });
}

export function useDashboardQuery(id: string | undefined) {
  return useQuery({
    queryKey: [...dashboardsQueryKey, id],
    queryFn: () => getDashboard(id as string),
    enabled: id !== undefined,
  });
}

export function useCreateDashboardMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDashboardInput) => createDashboard(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dashboardsQueryKey });
    },
  });
}

export function useUpdateDashboardMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateDashboardInput) => updateDashboard(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dashboardsQueryKey });
    },
  });
}

export function useDeleteDashboardMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDashboard(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dashboardsQueryKey });
    },
  });
}
