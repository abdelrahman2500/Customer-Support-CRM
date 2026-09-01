export const AUTOMATION_RULE_MATCHED_EVENT = "automation.rule_matched";

/**
 * Emitted once, by `AutomationEvaluationListener`, when a newly-created
 * ticket matches an active `AutomationRule` — never emitted for an update
 * or any other trigger (v1 only supports `ticket.created`, Design decision
 * 2). `TicketsModule`'s own `AutomationActionListener` is the sole
 * subscriber — mirrors `sla-detection.events.ts`'s own cross-domain event
 * shape (`SlaEscalatedEvent`, consumed only by `TicketEscalationListener`).
 */
export interface AutomationRuleMatchedEvent {
  ticketId: string;
  ruleId: string;
  assignToUserId: string;
  /** Story 83 — both optional/independent (a rule's own
   * `actionSetCategory`/`actionSetDepartmentId`, `null` when unset). */
  setCategory: string | null;
  setDepartmentId: string | null;
}
