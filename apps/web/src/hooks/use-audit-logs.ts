import { useQuery } from "@tanstack/react-query";
import { listAuditLogs } from "@/lib/audit-logs-api";

/**
 * Story 40 — dedicated audit-log hook, mirroring `use-sla-policies.ts`'s
 * "own file, no import from `use-tickets.ts`" convention. Read-only — no
 * mutation exists on this screen. No `staleTime` override: unlike the
 * infrequently-changing reference data `useUsersQuery`/`useRolesQuery` cache
 * for 5 minutes, the audit trail is expected to keep growing, so it uses the
 * same always-fresh default every other list query (`useTicketsQuery`,
 * `useSlaPoliciesQuery`) already uses.
 */
export function useAuditLogsQuery() {
  return useQuery({ queryKey: ["audit-logs"], queryFn: listAuditLogs });
}
