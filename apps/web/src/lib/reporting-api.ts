import { apiFetch } from "./api";

/**
 * Story 56 — Reporting & Analytics Foundation. A dedicated API client file,
 * mirroring `audit-logs-api.ts`/`sla-policies-api.ts`'s own "distinct
 * domain, own file, no import from `tickets-api.ts`" convention.
 *
 * Mirrors the backend's own `ReportingService` types
 * (`apps/api/src/modules/reporting/reporting.service.ts`) exactly.
 */
export interface TicketVolumeByStatus {
  status: string;
  count: number;
}

export interface SlaComplianceSummary {
  totalWithTarget: number;
  breachedCount: number;
  compliantCount: number;
  complianceRate: number | null;
}

export interface CsatSummary {
  responseCount: number;
  averageRating: number | null;
}

/** Story 59 — one row per agent with at least one ticket currently assigned
 * to them in this branch. */
export interface AgentPerformanceSummary {
  userId: string;
  fullName: string;
  openCount: number;
  resolvedCount: number;
}

/** Story 60 — always exactly these four buckets, in this order, zero-filled. */
export interface TicketAgingBucket {
  bucket: string;
  count: number;
}

export function getTicketVolumeByStatus(): Promise<TicketVolumeByStatus[]> {
  return apiFetch<TicketVolumeByStatus[]>("/reports/ticket-volume");
}

export function getSlaCompliance(): Promise<SlaComplianceSummary> {
  return apiFetch<SlaComplianceSummary>("/reports/sla-compliance");
}

export function getCsatSummary(): Promise<CsatSummary> {
  return apiFetch<CsatSummary>("/reports/csat");
}

export function getAgentPerformance(): Promise<AgentPerformanceSummary[]> {
  return apiFetch<AgentPerformanceSummary[]>("/reports/agent-performance");
}

export function getTicketAging(): Promise<TicketAgingBucket[]> {
  return apiFetch<TicketAgingBucket[]>("/reports/ticket-aging");
}
