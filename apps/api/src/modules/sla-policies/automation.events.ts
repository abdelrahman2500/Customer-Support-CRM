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
   * `actionSetCategoryId`/`actionSetDepartmentId`, `null` when unset).
   * Story 120 — `setCategory` (free text) renamed `setCategoryId` (a
   * `TicketCategory` id). */
  setCategoryId: string | null;
  setDepartmentId: string | null;
  /** RM-29 — the rule's own `actionSetPriority`, `null` when unset.
   * `AutomationActionListener` applies it only when `priorityExplicit`
   * (below) is `false` — see `AutomationRule.actionSetPriority`'s own
   * schema doc comment for why this can't reuse the `setCategoryId`/
   * `setDepartmentId` null-sentinel guard. */
  setPriority: string | null;
  /** RM-29 — carried straight through from `TicketCreatedEvent`
   * (computed once, at creation time): whether the ticket's creator
   * explicitly chose a priority. Never re-derived from the ticket's
   * current `priority` column, which is never `null` and so cannot answer
   * this question after the fact. */
  priorityExplicit: boolean;
}
