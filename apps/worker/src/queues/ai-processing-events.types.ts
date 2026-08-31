/**
 * Must stay identical to the corresponding declarations in
 * apps/api/src/queues/ai-processing-events-bridge.processor.ts — no
 * cross-app shared-constants/types mechanism exists in this repository
 * (Story 14's own precedent), so these are deliberately duplicated.
 */
export const AI_PROCESSING_EVENTS_QUEUE = "ai-processing-events";

/** Story 80 — `feature` now includes `CHAT`; `ticketId`/`chatSessionId`
 * are mutually exclusive by feature (both optional). */
export interface AiCompletionJobPayload {
  aiPromptLogId: string;
  feature: "SUMMARIZE" | "SUGGEST_REPLY" | "CATEGORIZE" | "CHAT";
  outcome: "SUCCESS" | "ERROR" | "DISABLED";
  ticketId?: string;
  chatSessionId?: string;
}
