import { apiFetch } from "./api";

/**
 * Story 79 — AI Ticket-Assist Result Delivery. Mirrors
 * `ticket-messages-api.ts`'s exact shape. `TicketAiFeature` is
 * deliberately narrower than the backend's full `AiFeature` enum (`CHAT`
 * has no ticket-scoped submit route — see `TicketAiService`'s own doc
 * comment); `AiResultSummary.feature` widens to include `"CHAT"` only
 * because it mirrors the backend's `AiFeature` column verbatim, never
 * because this UI submits a CHAT operation.
 */
export type TicketAiFeature = "SUMMARIZE" | "SUGGEST_REPLY" | "CATEGORIZE";

export interface AiResultSummary {
  id: string;
  feature: TicketAiFeature | "CHAT";
  outcome: "PENDING" | "SUCCESS" | "ERROR" | "DISABLED";
  outputText: string | null;
  errorMessage: string | null;
  createdAt: string;
}

const FEATURE_PATH: Record<TicketAiFeature, string> = {
  SUMMARIZE: "summarize",
  SUGGEST_REPLY: "suggest-reply",
  CATEGORIZE: "categorize",
};

/** `POST /tickets/:id/ai/{summarize,suggest-reply,categorize}`
 * (`ticket:read`) — returns the durable `AiPromptLog.id` immediately;
 * the actual result is retrieved separately via `getAiResult`. */
export function submitAiOperation(
  ticketId: string,
  feature: TicketAiFeature,
): Promise<{ id: string; outcome: "PENDING" }> {
  return apiFetch(`/tickets/${ticketId}/ai/${FEATURE_PATH[feature]}`, { method: "POST" });
}

/** `GET /tickets/:id/ai/:logId` (`ticket:read`). */
export function getAiResult(ticketId: string, logId: string): Promise<AiResultSummary> {
  return apiFetch<AiResultSummary>(`/tickets/${ticketId}/ai/${logId}`);
}
