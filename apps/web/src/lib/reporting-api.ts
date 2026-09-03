import { ApiError, apiFetch, getAccessToken, getApiBaseUrl } from "./api";

/**
 * Story 56 — Reporting & Analytics Foundation. A dedicated API client file,
 * mirroring `audit-logs-api.ts`/`sla-policies-api.ts`'s own "distinct
 * domain, own file, no import from `tickets-api.ts`" convention.
 *
 * Mirrors the backend's own `ReportingService` types
 * (`apps/api/src/modules/reporting/reporting.service.ts`) exactly.
 *
 * Story 93 — every function gains an optional `range` parameter
 * (`{from?, to?}`, each `YYYY-MM-DD`), serialized via `toQueryString`
 * (mirrors `tickets-api.ts`'s own identical helper — `URLSearchParams`,
 * skips `undefined`/`""`). Omitting `range` entirely reproduces each
 * function's exact pre-Story-93 call.
 */
export interface ReportDateRange {
  from?: string;
  to?: string;
}

function toQueryString(range: ReportDateRange): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(range)) {
    if (value !== undefined && value !== "") {
      params.set(key, value);
    }
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}
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

/** Story 99 — mirrors the backend's own `ResolutionTimeSummary` exactly.
 * `averageResolutionMs` is `null` (never `0`) when `resolvedCount` is `0`. */
export interface ResolutionTimeSummary {
  resolvedCount: number;
  averageResolutionMs: number | null;
}

/** Story 121 — mirrors the backend's own `AiUsageByFeature` exactly.
 * `totalCostUsd` is `null` (never `0`) when no successful call in this
 * feature has a priced cost. */
export interface AiUsageByFeature {
  feature: string;
  callCount: number;
  successCount: number;
  errorCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number | null;
}

/** Story 121 — mirrors the backend's own `AiUsageSummary` exactly.
 * `unpricedCallCount` is the count of successful calls excluded from
 * `totalCostUsd` because their model has no entry in the price table —
 * surfaced explicitly, never silently folded into the total as `$0`. */
export interface AiUsageSummary {
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number | null;
  unpricedCallCount: number;
  byFeature: AiUsageByFeature[];
}

export function getTicketVolumeByStatus(range: ReportDateRange = {}): Promise<TicketVolumeByStatus[]> {
  return apiFetch<TicketVolumeByStatus[]>(`/reports/ticket-volume${toQueryString(range)}`);
}

/**
 * Story 126 — mirrors the backend's own `TicketVolumeByCategory` exactly.
 * `categoryName` is `null` for the `categoryId: null` row — this codebase's
 * "backend returns raw data, frontend supplies the user-facing label"
 * split (see `ReportsView`'s own render for the localized "Uncategorized"
 * label it renders for that row).
 */
export interface TicketVolumeByCategory {
  categoryId: string | null;
  categoryName: string | null;
  count: number;
}

export function getTicketVolumeByCategory(
  range: ReportDateRange = {},
): Promise<TicketVolumeByCategory[]> {
  return apiFetch<TicketVolumeByCategory[]>(`/reports/ticket-volume-by-category${toQueryString(range)}`);
}

export function getSlaCompliance(range: ReportDateRange = {}): Promise<SlaComplianceSummary> {
  return apiFetch<SlaComplianceSummary>(`/reports/sla-compliance${toQueryString(range)}`);
}

export function getCsatSummary(range: ReportDateRange = {}): Promise<CsatSummary> {
  return apiFetch<CsatSummary>(`/reports/csat${toQueryString(range)}`);
}

export function getAgentPerformance(range: ReportDateRange = {}): Promise<AgentPerformanceSummary[]> {
  return apiFetch<AgentPerformanceSummary[]>(`/reports/agent-performance${toQueryString(range)}`);
}

export function getTicketAging(range: ReportDateRange = {}): Promise<TicketAgingBucket[]> {
  return apiFetch<TicketAgingBucket[]>(`/reports/ticket-aging${toQueryString(range)}`);
}

export function getResolutionTime(range: ReportDateRange = {}): Promise<ResolutionTimeSummary> {
  return apiFetch<ResolutionTimeSummary>(`/reports/resolution-time${toQueryString(range)}`);
}

export function getAiUsage(range: ReportDateRange = {}): Promise<AiUsageSummary> {
  return apiFetch<AiUsageSummary>(`/reports/ai-usage${toQueryString(range)}`);
}

/** Story 125 — Reporting Export. One path segment per existing report,
 * matching `ReportingController`'s own new `GET /reports/<name>/export`
 * routes exactly. */
export type ReportExportPath =
  | "ticket-volume"
  | "sla-compliance"
  | "csat"
  | "agent-performance"
  | "ticket-aging"
  | "resolution-time"
  | "ai-usage"
  | "ticket-volume-by-category";

/**
 * Story 125 — Reporting Export. A raw, dedicated `fetch` — not routed
 * through `apiFetch` — since `apiFetch`/`attempt` always call
 * `response.json()`, which cannot parse a CSV body. Mirrors `attempt`'s
 * own Bearer-header/non-2xx-to-`ApiError` handling, but resolves to a
 * `Blob` plus the filename the backend's own `Content-Disposition` header
 * chose (`ReportingController`'s `sendCsv`) — the caller (`ReportsView`)
 * turns that into a real browser download via `URL.createObjectURL` + a
 * synthetic `<a>` click, since this repo's auth is a JS-readable Bearer
 * token, not an httpOnly session cookie a plain `<a href>` could rely on.
 */
export async function downloadReportCsv(
  reportPath: ReportExportPath,
  range: ReportDateRange = {},
): Promise<{ blob: Blob; filename: string }> {
  const token = getAccessToken();
  const response = await fetch(
    `${getApiBaseUrl()}/reports/${reportPath}/export${toQueryString(range)}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (!response.ok) {
    throw new ApiError(`Failed to export ${reportPath}`, response.status);
  }
  const disposition = response.headers.get("content-disposition") ?? "";
  const filenameMatch = /filename="([^"]+)"/.exec(disposition);
  const filename = filenameMatch?.[1] ?? `${reportPath}.csv`;
  const blob = await response.blob();
  return { blob, filename };
}

/**
 * Story 110 — Saved Dashboards. `widgetType` mirrors the backend's
 * `ReportWidgetType` enum values exactly — one per existing report
 * function above. A dashboard has no saved date range: it reuses
 * whichever `{from, to}` this page's own shared control currently has
 * (Story 93's own explicit decision against per-card independent
 * controls).
 */
export type ReportWidgetType =
  | "TICKET_VOLUME"
  | "SLA_COMPLIANCE"
  | "CSAT"
  | "AGENT_PERFORMANCE"
  | "TICKET_AGING"
  | "RESOLUTION_TIME"
  | "AI_USAGE"
  | "TICKET_VOLUME_BY_CATEGORY";

export interface DashboardWidgetSummary {
  widgetType: ReportWidgetType;
  position: number;
}

export interface DashboardSummary {
  id: string;
  name: string;
  isShared: boolean;
  isOwner: boolean;
  widgets: DashboardWidgetSummary[];
}

export interface CreateDashboardInput {
  name: string;
  isShared?: boolean;
  widgetTypes: ReportWidgetType[];
}

export interface UpdateDashboardInput {
  name?: string;
  isShared?: boolean;
  widgetTypes?: ReportWidgetType[];
}

export function listDashboards(): Promise<DashboardSummary[]> {
  return apiFetch<DashboardSummary[]>("/reports/dashboards");
}

export function getDashboard(id: string): Promise<DashboardSummary> {
  return apiFetch<DashboardSummary>(`/reports/dashboards/${id}`);
}

export function createDashboard(input: CreateDashboardInput): Promise<{ id: string }> {
  return apiFetch<{ id: string }>("/reports/dashboards", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateDashboard(
  id: string,
  input: UpdateDashboardInput,
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/reports/dashboards/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteDashboard(id: string): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/reports/dashboards/${id}`, { method: "DELETE" });
}
