import { apiFetch } from "./api";

/**
 * RM-22 — API-Key Authentication for Machine-to-Machine Consumers. A
 * dedicated API client file, mirroring `webhook-subscriptions-api.ts`'s
 * own "distinct domain, own file" convention.
 *
 * Mirrors the backend's own `ApiKeySummary`/`ApiKeyCreated`
 * (`apps/api/src/modules/integrations/api-keys.service.ts`) exactly.
 * `createdAt`/`expiresAt`/`revokedAt`/`lastUsedAt` are `string | null`, not
 * `Date`/`Date | null` — the JSON-serialized ISO strings the real response
 * actually contains, mirroring `WebhookSubscriptionSummary`'s own
 * precedent.
 */
export const API_KEY_SCOPES = ["integration:read", "integration:write"] as const;

export interface ApiKeySummary {
  id: string;
  label: string;
  keyPrefix: string;
  scopes: string[];
  expiresAt: string | null;
  revokedAt: string | null;
  createdByUserId: string;
  lastUsedAt: string | null;
  createdAt: string;
}

/** Returned only from `createApiKey` — never again. */
export interface ApiKeyCreated extends ApiKeySummary {
  rawKey: string;
}

export interface CreateApiKeyInput {
  label: string;
  scopes: string[];
  expiresAt?: string;
}

export function listApiKeys(): Promise<ApiKeySummary[]> {
  return apiFetch<ApiKeySummary[]>("/integrations/api-keys");
}

export function createApiKey(input: CreateApiKeyInput): Promise<ApiKeyCreated> {
  return apiFetch<ApiKeyCreated>("/integrations/api-keys", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function revokeApiKey(id: string): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/integrations/api-keys/${id}`, {
    method: "DELETE",
  });
}
