const MINUTE_MS = 60_000;
const AT_RISK_FRACTION = 0.2;

export type SlaTransition = "breach" | "at_risk" | "none";

export interface EvaluateTransitionInput {
  now: Date;
  targetAt: Date;
  targetMinutes: number;
  alreadyAtRiskNotified: boolean;
  alreadyBreachedNotified: boolean;
}

/**
 * Pure, dependency-free — no Prisma, no BullMQ — so it can be unit-tested
 * exhaustively without mocking anything, the same reasoning
 * apps/api/src/modules/sla-policies/business-hours-calculator.ts (Story
 * 13) already established for this codebase's other pure-function
 * extraction. Does not read or recompute business hours — `targetAt` is
 * taken as an already-resolved absolute instant.
 *
 * Breach is checked before at-risk on every call: once `now >= targetAt`,
 * this always returns "breach" (or "none" if already notified),
 * regardless of the at-risk threshold or its own notified state — this is
 * what guarantees a direct not-at-risk -> breached transition emits only
 * `sla.breached`, never a retroactive `sla.at_risk` (Settled decision 5).
 */
export function evaluateTransition(input: EvaluateTransitionInput): SlaTransition {
  if (!input.alreadyBreachedNotified && input.now.getTime() >= input.targetAt.getTime()) {
    return "breach";
  }
  if (!input.alreadyBreachedNotified && !input.alreadyAtRiskNotified) {
    const atRiskThresholdMs = input.targetAt.getTime() - input.targetMinutes * MINUTE_MS * AT_RISK_FRACTION;
    if (input.now.getTime() >= atRiskThresholdMs) {
      return "at_risk";
    }
  }
  return "none";
}
