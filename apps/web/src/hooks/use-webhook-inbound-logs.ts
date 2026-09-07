import { useQuery } from "@tanstack/react-query";
import { listWebhookInboundLogs } from "@/lib/webhook-inbound-logs-api";
import { preservePreviousResults } from "@/lib/list-query";

/** RM-21 — read-only, mirrors `useWebhookDeliveryAttemptsQuery`'s own
 * shape (no mutations: this list is populated only by real inbound
 * requests).
 *
 * Batch 2 (UX audit) — `page` is part of the query key, exactly like
 * `useAuditLogsQuery`'s own `filters.page` (Story S-7/S-8a), so this was
 * the one paginated hook in the app missing `preservePreviousResults`: its
 * own consumer (`webhook-subscriptions-view.tsx`) already reads
 * `isPlaceholderData` to drive `Pagination`'s in-flight state, but with no
 * placeholder data that flag could never be true — every page change blanked
 * the table to a single loading row instead of keeping the outgoing page's
 * rows on screen. */
export function useWebhookInboundLogsQuery(page: number) {
  return useQuery({
    queryKey: ["webhook-inbound-logs", page] as const,
    queryFn: () => listWebhookInboundLogs(page),
    ...preservePreviousResults,
  });
}
