import { apiFetch } from "./api";
import type { PaginatedResponse } from "./paginated";

/**
 * RM-21 — Inbound Webhook Receiver + Signature Verification Framework. A
 * dedicated API client file, mirroring `webhook-subscriptions-api.ts`'s own
 * "distinct concern, own file" convention even though both render on the
 * same page.
 *
 * Mirrors the backend's own `WebhookInboundLogSummary`
 * (`apps/api/src/modules/integrations/webhook-inbound.service.ts`) exactly.
 */
export interface WebhookInboundLogSummary {
  id: string;
  providerKey: string;
  verified: boolean;
  rejectReason: string | null;
  headers: unknown;
  body: string;
  receivedAt: string;
}

export function listWebhookInboundLogs(page = 1): Promise<PaginatedResponse<WebhookInboundLogSummary>> {
  return apiFetch<PaginatedResponse<WebhookInboundLogSummary>>(
    `/integrations/webhook-inbound-logs?page=${page}`,
  );
}
