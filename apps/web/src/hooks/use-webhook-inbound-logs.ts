import { useQuery } from "@tanstack/react-query";
import { listWebhookInboundLogs } from "@/lib/webhook-inbound-logs-api";

/** RM-21 — read-only, mirrors `useWebhookDeliveryAttemptsQuery`'s own
 * shape (no mutations: this list is populated only by real inbound
 * requests). */
export function useWebhookInboundLogsQuery(page: number) {
  return useQuery({
    queryKey: ["webhook-inbound-logs", page] as const,
    queryFn: () => listWebhookInboundLogs(page),
  });
}
