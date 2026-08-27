/**
 * Story 23, plan Design item 4 — "SLA status" is derived purely from the
 * existing `responseTargetAt`/`resolutionTargetAt` timestamps
 * (`GET /tickets` list rows' embedded `slaTarget`, or the dedicated
 * `GET /tickets/:id/sla-target`). No backend endpoint returns an "at
 * risk"/"breached" label anywhere — this does not reproduce or approximate
 * the SLA module's own internal "at risk" warning threshold (that stays a
 * backend-owned concern); it only surfaces what the data already expresses:
 * a target timestamp, and whether it has passed.
 */
export interface TicketSlaTarget {
  responseTargetAt: string | Date;
  resolutionTargetAt: string | Date;
}

export type SlaStatus =
  | { kind: "none" }
  | { kind: "breached"; targetAt: Date }
  | { kind: "on-track"; targetAt: Date; remainingMs: number };

/**
 * The *earlier* of the two targets is the one that governs urgency — once
 * the response target passes, the resolution target passing next doesn't
 * make the ticket "more breached"; it's already breached. Symmetrically,
 * while still on track, the soonest upcoming target is what an agent needs
 * to see. `null` input (no `SlaTicketTarget` row — Context item 4 of the
 * plan) maps to `{ kind: "none" }`, not an error.
 */
export function deriveSlaStatus(target: TicketSlaTarget | null, now: Date = new Date()): SlaStatus {
  if (!target) {
    return { kind: "none" };
  }
  const responseAt = new Date(target.responseTargetAt);
  const resolutionAt = new Date(target.resolutionTargetAt);
  const earliest = responseAt.getTime() <= resolutionAt.getTime() ? responseAt : resolutionAt;

  if (now.getTime() > earliest.getTime()) {
    return { kind: "breached", targetAt: earliest };
  }
  return { kind: "on-track", targetAt: earliest, remainingMs: earliest.getTime() - now.getTime() };
}

/** Formats a remaining duration as e.g. "2h 15m" / "45m" / "<1m". */
export function formatRemaining(ms: number): string {
  if (ms <= 0) {
    return "<1m";
  }
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) {
    return `${minutes}m`;
  }
  return `${hours}h ${minutes}m`;
}
