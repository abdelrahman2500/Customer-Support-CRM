/**
 * Story 191 (RD-1.14) — how a ticket status or priority *looks*: a semantic
 * tone and an icon key per value. Pure data, shared by both frontends so
 * they cannot drift (decision D12); each app turns the tone into a Badge
 * variant, the icon key into an icon, and the value into its own localized
 * label. The binding source is `docs/architecture/13-design-language.md`
 * ("Status semantics"):
 *
 * - status: OPEN → info · IN_PROGRESS → progress · RESOLVED → success ·
 *   CLOSED → neutral
 * - priority: LOW / MEDIUM → neutral · HIGH → warning · URGENT → danger
 *
 * Statuses never use warning/danger and priorities never use
 * info/progress, so a status and a priority side by side never share a
 * tone (OPEN ≠ HIGH, IN_PROGRESS ≠ LOW/MEDIUM). Every value also has its own
 * icon: colour is never the only signal.
 *
 * The value lists mirror `TicketStatus` / `TicketPriority` in
 * `apps/api/prisma/schema.prisma` (`TaskPriority` has the same members).
 */

export const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
export type TicketStatusValue = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type TicketPriorityValue = (typeof TICKET_PRIORITIES)[number];

export type PresentationTone = "neutral" | "info" | "progress" | "success" | "warning" | "danger";

export type TicketPresentationIcon =
  | "status-open"
  | "status-in-progress"
  | "status-resolved"
  | "status-closed"
  | "priority-low"
  | "priority-medium"
  | "priority-high"
  | "priority-urgent";

export interface TicketPresentation {
  tone: PresentationTone;
  icon: TicketPresentationIcon;
}

export const TICKET_STATUS_PRESENTATION: Readonly<Record<TicketStatusValue, TicketPresentation>> = {
  OPEN: { tone: "info", icon: "status-open" },
  IN_PROGRESS: { tone: "progress", icon: "status-in-progress" },
  RESOLVED: { tone: "success", icon: "status-resolved" },
  CLOSED: { tone: "neutral", icon: "status-closed" },
};

export const TICKET_PRIORITY_PRESENTATION: Readonly<
  Record<TicketPriorityValue, TicketPresentation>
> = {
  LOW: { tone: "neutral", icon: "priority-low" },
  MEDIUM: { tone: "neutral", icon: "priority-medium" },
  HIGH: { tone: "warning", icon: "priority-high" },
  URGENT: { tone: "danger", icon: "priority-urgent" },
};

function isKey<T extends string>(record: Readonly<Record<T, unknown>>, value: string): value is T {
  return Object.prototype.hasOwnProperty.call(record, value);
}

/** Tolerant lookup: a value the API adds before the frontends know it reads
 * as a quiet, neutral status rather than crashing a list. */
export function ticketStatusPresentation(status: string): TicketPresentation {
  return isKey(TICKET_STATUS_PRESENTATION, status)
    ? TICKET_STATUS_PRESENTATION[status]
    : { tone: "neutral", icon: "status-open" };
}

/** Tolerant lookup, as `ticketStatusPresentation`. */
export function ticketPriorityPresentation(priority: string): TicketPresentation {
  return isKey(TICKET_PRIORITY_PRESENTATION, priority)
    ? TICKET_PRIORITY_PRESENTATION[priority]
    : { tone: "neutral", icon: "priority-medium" };
}
