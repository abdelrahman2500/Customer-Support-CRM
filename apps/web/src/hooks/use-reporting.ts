import { useQuery } from "@tanstack/react-query";
import {
  getAgentPerformance,
  getCsatSummary,
  getSlaCompliance,
  getTicketAging,
  getTicketVolumeByStatus,
} from "@/lib/reporting-api";

/**
 * Story 56 — dedicated reporting hooks, mirroring `use-audit-logs.ts`'s "own
 * file, no import from `use-tickets.ts`" convention. Read-only — no
 * mutation exists on this screen. No `staleTime` override: mirrors
 * `useAuditLogsQuery`'s always-fresh default, since these aggregates change
 * whenever a ticket/SLA/CSAT event happens elsewhere.
 */
export function useTicketVolumeQuery() {
  return useQuery({ queryKey: ["reports", "ticket-volume"], queryFn: getTicketVolumeByStatus });
}

export function useSlaComplianceQuery() {
  return useQuery({ queryKey: ["reports", "sla-compliance"], queryFn: getSlaCompliance });
}

export function useCsatSummaryQuery() {
  return useQuery({ queryKey: ["reports", "csat"], queryFn: getCsatSummary });
}

export function useAgentPerformanceQuery() {
  return useQuery({ queryKey: ["reports", "agent-performance"], queryFn: getAgentPerformance });
}

export function useTicketAgingQuery() {
  return useQuery({ queryKey: ["reports", "ticket-aging"], queryFn: getTicketAging });
}
