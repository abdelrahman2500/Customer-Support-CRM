import { useQuery } from "@tanstack/react-query";
import { listAuditLogs } from "@/lib/audit-logs-api";
import type { AuditLogFilters } from "@/lib/audit-logs-api";
import { preservePreviousResults } from "@/lib/list-query";

/**
 * Story 40 — dedicated audit-log hook, mirroring `use-sla-policies.ts`'s
 * "own file, no import from `use-tickets.ts`" convention. Read-only — no
 * mutation exists on this screen. No `staleTime` override: unlike the
 * infrequently-changing reference data `useUsersQuery`/`useRolesQuery` cache
 * for 5 minutes, the audit trail is expected to keep growing, so it uses the
 * same always-fresh default every other list query (`useTicketsQuery`,
 * `useSlaPoliciesQuery`) already uses.
 *
 * Story 104 — gains an optional `filters` param, included in the query key,
 * mirroring `useCustomersQuery(filters)`'s own Story 101 parameterization.
 * Omitting it reproduces the exact pre-Story-104 all-time request.
 *
 * Story S-8a — `filters` now carries `page`/`pageSize`, so a page change
 * is a new query key exactly like a filter change. That makes
 * `preservePreviousResults` (Story S-7) do double duty here: the rows of
 * the page being left stay on screen while the next one loads, so paging
 * never blanks the table into a skeleton.
 */
export function useAuditLogsQuery(filters: AuditLogFilters = {}) {
  return useQuery({
    queryKey: ["audit-logs", filters],
    queryFn: () => listAuditLogs(filters),
    ...preservePreviousResults,
  });
}
