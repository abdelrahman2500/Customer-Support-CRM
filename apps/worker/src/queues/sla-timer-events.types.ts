/**
 * Must stay identical to the corresponding declarations in
 * apps/api/src/queues/sla-timer-events-bridge.processor.ts — no cross-app
 * shared-constants/types mechanism exists in this repository (see Story
 * 14's precedent for `HEALTH_CHECK_QUEUE`), so these are deliberately
 * duplicated, not imported.
 */
export const SLA_TIMER_EVENTS_QUEUE = "sla-timer-events";
export const SLA_AT_RISK_EVENT = "sla.at_risk";
export const SLA_BREACHED_EVENT = "sla.breached";

export type SlaTargetType = "response" | "resolution";

export interface SlaDetectionJobPayload {
  eventType: typeof SLA_AT_RISK_EVENT | typeof SLA_BREACHED_EVENT;
  ticketId: string;
  branchId: string;
  targetType: SlaTargetType;
  targetAt: string;
}
