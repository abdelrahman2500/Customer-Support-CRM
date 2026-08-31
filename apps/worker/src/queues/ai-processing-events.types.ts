/**
 * Must stay identical to the corresponding declarations in
 * apps/api/src/queues/ai-processing-events-bridge.processor.ts — no
 * cross-app shared-constants/types mechanism exists in this repository
 * (Story 14's own precedent), so these are deliberately duplicated.
 */
export const AI_PROCESSING_EVENTS_QUEUE = "ai-processing-events";

export interface AiCompletionJobPayload {
  aiPromptLogId: string;
  ticketId: string;
  feature: "SUMMARIZE" | "SUGGEST_REPLY" | "CATEGORIZE";
  outcome: "SUCCESS" | "ERROR" | "DISABLED";
}
