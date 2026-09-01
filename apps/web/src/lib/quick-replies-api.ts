import { apiFetch } from "./api";

/**
 * Story 91 — Communication/Channels: Quick Replies. A dedicated API client
 * file, mirroring `automation-rules-api.ts`'s own "distinct domain, own
 * file" convention.
 *
 * Mirrors the backend's own `QuickReplySummary`
 * (`apps/api/src/modules/channels/quick-replies.service.ts`) exactly.
 */
export interface QuickReplySummary {
  id: string;
  title: string;
  body: string;
  isActive: boolean;
}

export interface CreateQuickReplyInput {
  title: string;
  body: string;
}

export interface UpdateQuickReplyInput {
  title?: string;
  body?: string;
  isActive?: boolean;
}

export function listQuickReplies(): Promise<QuickReplySummary[]> {
  return apiFetch<QuickReplySummary[]>("/quick-replies");
}

export function createQuickReply(input: CreateQuickReplyInput): Promise<QuickReplySummary> {
  return apiFetch<QuickReplySummary>("/quick-replies", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateQuickReply(
  id: string,
  input: UpdateQuickReplyInput,
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/quick-replies/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
