import { apiFetch } from "./api";
import type { PaginatedResponse } from "./paginated";

export type { PaginatedResponse };

/**
 * Story 40 — Audit Log Viewer. A dedicated API client file, mirroring
 * `sla-policies-api.ts`/`roles-api.ts`/`business-hours-api.ts`'s own
 * "distinct domain, own file, no import from `tickets-api.ts`" convention.
 *
 * Mirrors the backend's own `AuditLogSummary`
 * (`apps/api/src/modules/admin/audit-logs.service.ts`) exactly — confirmed
 * against that file during implementation. `createdAt` is typed as `string`
 * here (not `Date`) because every date field already crossing this API
 * boundary (`TicketSummary.createdAt`, etc.) is the JSON-serialized ISO
 * string the real `GET /audit-logs` response actually contains, not a
 * `Date` instance.
 */
export interface AuditLogSummary {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  branchId: string | null;
  diff: unknown;
  ipAddress: string | null;
  createdAt: string;
}

/** Story 104 — mirrors `ListCustomersFilters`'s own shape/`toQueryString`
 * convention. `action`/`entityType` match `ListAuditLogsQueryDto`'s exact
 * exact-match semantics on the backend (never `contains`). */
export interface AuditLogFilters {
  action?: string;
  entityType?: string;
  actorId?: string;
  from?: string;
  to?: string;
  /** Story S-8a — 1-based; omitted means the first page. */
  page?: number;
  /** Story S-8a — omitted means the API's own default (25). */
  pageSize?: number;
}

function toQueryString(filters: AuditLogFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    // `page`/`pageSize` are numbers, so this no longer narrows to string;
    // `0` is not a valid page anyway and the backend would reject it.
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function listAuditLogs(
  filters: AuditLogFilters = {},
): Promise<PaginatedResponse<AuditLogSummary>> {
  return apiFetch<PaginatedResponse<AuditLogSummary>>(`/audit-logs${toQueryString(filters)}`);
}
