export const SLA_AT_RISK_EVENT = "sla.at_risk";
export const SLA_BREACHED_EVENT = "sla.breached";

export type SlaTargetType = "response" | "resolution";

interface SlaDetectionEventBase {
  ticketId: string;
  branchId: string;
  targetType: SlaTargetType;
  targetAt: Date;
}

/** Emitted when a target enters the final 20% of its configured SLA duration, still before targetAt. */
export interface SlaAtRiskEvent extends SlaDetectionEventBase {}

/** Emitted once `now >= targetAt`. */
export interface SlaBreachedEvent extends SlaDetectionEventBase {}
