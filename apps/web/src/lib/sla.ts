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
  /** RM-25 — SLA Pause/Resume. `null`/absent means not on hold. */
  onHoldSince?: string | Date | null;
}

/** Story 192 (RD-1.15) — which of the two targets governs. */
export type SlaTargetKind = "response" | "resolution";

export type SlaStatus =
  | { kind: "none" }
  | { kind: "breached"; targetAt: Date; governing: SlaTargetKind }
  | {
      kind: "on-track";
      targetAt: Date;
      remainingMs: number;
      governing: SlaTargetKind;
      /** Story 192 — the at-risk presentation tier (decision D3). */
      atRisk: boolean;
    }
  | { kind: "on-hold"; onHoldSince: Date };

/** D3 — at risk at ≤ 60 minutes remaining … */
const AT_RISK_MINUTES_MS = 60 * 60_000;
/** … or at ≤ 25% of the governing target's window, whichever comes first. */
const AT_RISK_WINDOW_FRACTION = 0.25;

/**
 * The *earlier* of the two targets is the one that governs urgency — once
 * the response target passes, the resolution target passing next doesn't
 * make the ticket "more breached"; it's already breached. Symmetrically,
 * while still on track, the soonest upcoming target is what an agent needs
 * to see. `null` input (no `SlaTicketTarget` row — Context item 4 of the
 * plan) maps to `{ kind: "none" }`, not an error.
 */
export function deriveSlaStatus(
  target: TicketSlaTarget | null,
  now: Date = new Date(),
  options: { createdAt?: string | Date } = {},
): SlaStatus {
  if (!target) {
    return { kind: "none" };
  }
  // RM-25 — checked before any target-timestamp math: a held target's
  // `responseTargetAt`/`resolutionTargetAt` are whatever they were at the
  // moment the hold began (frozen, not advancing), so comparing them
  // against `now` while on hold would show a ticking-toward-breach
  // countdown for a clock that isn't actually running.
  if (target.onHoldSince) {
    return { kind: "on-hold", onHoldSince: new Date(target.onHoldSince) };
  }
  const responseAt = new Date(target.responseTargetAt);
  const resolutionAt = new Date(target.resolutionTargetAt);
  const governing: SlaTargetKind =
    responseAt.getTime() <= resolutionAt.getTime() ? "response" : "resolution";
  const earliest = governing === "response" ? responseAt : resolutionAt;

  if (now.getTime() > earliest.getTime()) {
    return { kind: "breached", targetAt: earliest, governing };
  }
  const remainingMs = earliest.getTime() - now.getTime();
  return {
    kind: "on-track",
    targetAt: earliest,
    remainingMs,
    governing,
    atRisk: isAtRisk(remainingMs, earliest, options.createdAt),
  };
}

/**
 * Story 192 (RD-1.15), decision D3 — a presentation tier only; it changes no
 * business rule and does not reproduce the SLA module's own warning job.
 * The window is measured from ticket creation to the governing target;
 * without a creation time (or with a non-positive window) only the
 * 60-minute rule applies.
 */
function isAtRisk(
  remainingMs: number,
  targetAt: Date,
  createdAt: string | Date | undefined,
): boolean {
  if (remainingMs <= AT_RISK_MINUTES_MS) {
    return true;
  }
  if (createdAt === undefined) {
    return false;
  }
  const windowMs = targetAt.getTime() - new Date(createdAt).getTime();
  return windowMs > 0 && remainingMs <= windowMs * AT_RISK_WINDOW_FRACTION;
}

/** Story 192 — a duration as whole hours and minutes, or `null` under a
 * minute. `SlaIndicator` formats it through the i18n unit keys;
 * `formatRemaining` below keeps its own Latin-unit output for the reports
 * page. */
export function splitDuration(ms: number): { hours: number; minutes: number } | null {
  const totalMinutes = Math.floor(ms / 60_000);
  if (totalMinutes <= 0) {
    return null;
  }
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
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
