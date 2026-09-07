import { apiFetch } from "./api";
import type { PaginatedResponse } from "./paginated";

/**
 * RM-20 — Webhook Subscriptions + Outbound Event Dispatch. A dedicated API
 * client file, mirroring `automation-rules-api.ts`'s own "distinct domain,
 * own file" convention.
 *
 * Mirrors the backend's own `WebhookSubscriptionSummary`/
 * `WebhookDeliveryAttemptSummary`
 * (`apps/api/src/modules/integrations/webhook-subscriptions.service.ts`)
 * exactly. `createdAt`/`updatedAt`/`attemptedAt` are `string`, not `Date` —
 * the JSON-serialized ISO strings the real response actually contains,
 * mirroring `AuditLogSummary.createdAt`'s own precedent.
 */
export const WEBHOOK_EVENT_TYPES = [
  "ticket.created",
  "ticket.updated",
  "ticket.escalated",
  "sla.at_risk",
  "sla.breached",
  "channel.message.created",
] as const;

export interface WebhookSubscriptionSummary {
  id: string;
  targetUrl: string;
  subscribedEventTypes: string[];
  isActive: boolean;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

/** Returned only from `createWebhookSubscription` — never again. */
export interface WebhookSubscriptionCreated extends WebhookSubscriptionSummary {
  secret: string;
}

export interface WebhookDeliveryAttemptSummary {
  id: string;
  eventType: string;
  succeeded: boolean;
  responseStatus: number | null;
  errorMessage: string | null;
  attemptedAt: string;
}

export interface CreateWebhookSubscriptionInput {
  targetUrl: string;
  subscribedEventTypes: string[];
}

export interface UpdateWebhookSubscriptionInput {
  targetUrl?: string;
  subscribedEventTypes?: string[];
  isActive?: boolean;
}

export function listWebhookSubscriptions(): Promise<WebhookSubscriptionSummary[]> {
  return apiFetch<WebhookSubscriptionSummary[]>("/integrations/webhook-subscriptions");
}

export function createWebhookSubscription(
  input: CreateWebhookSubscriptionInput,
): Promise<WebhookSubscriptionCreated> {
  return apiFetch<WebhookSubscriptionCreated>("/integrations/webhook-subscriptions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateWebhookSubscription(
  id: string,
  input: UpdateWebhookSubscriptionInput,
): Promise<WebhookSubscriptionSummary> {
  return apiFetch<WebhookSubscriptionSummary>(`/integrations/webhook-subscriptions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteWebhookSubscription(id: string): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/integrations/webhook-subscriptions/${id}`, {
    method: "DELETE",
  });
}

export function listWebhookDeliveryAttempts(
  id: string,
  page = 1,
): Promise<PaginatedResponse<WebhookDeliveryAttemptSummary>> {
  return apiFetch<PaginatedResponse<WebhookDeliveryAttemptSummary>>(
    `/integrations/webhook-subscriptions/${id}/delivery-attempts?page=${page}`,
  );
}
