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

export function getTicketVolumeByStatus(): Promise<TicketVolumeByStatus[]> {
  return apiFetch<TicketVolumeByStatus[]>("/reports/ticket-volume");
}

export function getSlaCompliance(): Promise<SlaComplianceSummary> {
  return apiFetch<SlaComplianceSummary>("/reports/sla-compliance");
}

export function getCsatSummary(): Promise<CsatSummary> {
  return apiFetch<CsatSummary>("/reports/csat");
}
