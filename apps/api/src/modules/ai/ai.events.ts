/**
 * Story 76 — mirrors `../sla-policies/sla-detection.events.ts`'s exact
 * shape/placement: the in-process `EventEmitter2` domain event
 * `AiProcessingEventsBridgeProcessor` emits once `apps/worker` hands an
 * AI operation's outcome back. Only `TicketRealtimeListener` reacts to
 * this today (relayed verbatim into `ticket:{id}`) — no notification/
 * other consumer exists, mirroring `sla.at_risk`/`sla.breached`'s own
 * single-consumer state at the point they were introduced.
 */
export const AI_PROMPT_COMPLETED_EVENT = "ai.prompt_completed";

/** Never the full AI result text — the durable `AiPromptLog` row (looked
 * up by `aiPromptLogId`) remains the source of truth; this is only
 * enough for an already-authorized client watching `ticket:{id}` to know
 * a result changed and which operation it was. */
export interface AiPromptCompletedEvent {
  aiPromptLogId: string;
  ticketId: string;
  feature: "SUMMARIZE" | "SUGGEST_REPLY" | "CATEGORIZE";
  outcome: "SUCCESS" | "ERROR" | "DISABLED";
}
