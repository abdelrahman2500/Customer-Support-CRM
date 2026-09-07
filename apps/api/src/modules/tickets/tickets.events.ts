import type { TicketNoteSummary, TicketSummary } from "./tickets.service";

export const TICKET_CREATED_EVENT = "ticket.created";
export const TICKET_UPDATED_EVENT = "ticket.updated";

/** Emitted once, after `TicketsService.createTicket` successfully persists the row.
 *
 * RM-29 — `priorityExplicit` added: whether the creating caller's own DTO
 * included a `priority` (`true`) or left it to default to `MEDIUM`
 * (`false`). Computed once, here, at the moment of creation — the only
 * point this fact is ever knowable, since `Ticket.priority` itself is
 * never `null` and so cannot answer "was this ever explicitly chosen?"
 * after the fact. Consumed by `AutomationEvaluationListener` to decide
 * whether an automation rule's `actionSetPriority` may apply. */
export interface TicketCreatedEvent {
  ticket: TicketSummary;
  actorUserId: string | null;
  priorityExplicit: boolean;
}

/** Emitted once, after `TicketsService.updateTicket` successfully persists the row. */
export interface TicketUpdatedEvent {
  ticket: TicketSummary;
  actorUserId: string | null;
}

export const TICKET_RECATEGORIZED_EVENT = "ticket.recategorized";

/**
 * Emitted once, after `TicketsService.updateTicket` successfully persists a
 * change to `category`, `priority`, or `departmentId` — the SLA-policy
 * matching fields. Always accompanied by `TICKET_UPDATED_EVENT` in the same
 * call (this event does not replace it). Payload shape mirrors
 * `TicketUpdatedEvent` exactly — no `branchId`/`createdAt`; subscribers
 * re-fetch those by `ticket.id`.
 */
export interface TicketRecategorizedEvent {
  ticket: TicketSummary;
  actorUserId: string | null;
}

export const TICKET_ESCALATED_EVENT = "ticket.escalated";

/**
 * Emitted once, after the SLA & Automation domain's `sla.escalated`
 * reaction (Story 17) is translated into a Ticketing-owned event by
 * `TicketEscalationListener`. `actorUserId` is always `null` — no human
 * actor is involved in a system-triggered escalation. Does not imply any
 * `Ticket` field changed: priority, assignment, and department are
 * untouched by this event.
 */
export interface TicketEscalatedEvent {
  ticket: TicketSummary;
  actorUserId: string | null;
}

export const TICKET_NOTE_ADDED_EVENT = "ticket.note-added";

/**
 * Emitted once, after `TicketsService.createTicketNote` successfully persists
 * the row. Payload deliberately differs from the other ticket events' shared
 * shape (Design item 6) — carries the note itself, not the whole ticket.
 */
export interface TicketNoteAddedEvent {
  ticketId: string;
  note: TicketNoteSummary;
}

export const TICKET_MENTIONED_EVENT = "ticket.mentioned";

/**
 * RM-06 — emitted once per resolved `@mention` found in a
 * `TicketsService.createTicketNote` body (never for the note's own
 * author, mentioning yourself notifies no one) — a single note mentioning
 * three agents emits three of these, one per recipient, mirroring
 * `TicketNoteAddedEvent`'s own "carries the specific thing, not the whole
 * ticket" shape. `TicketMentionNotificationListener` persists a
 * `NotificationLog` row from this; `TicketMentionRealtimeListener` relays
 * it into `agent:{recipientUserId}:notifications`.
 */
export interface TicketMentionedEvent {
  ticketId: string;
  noteId: string;
  recipientUserId: string;
  actorUserId: string;
}

export const TICKET_ON_HOLD_EVENT = "ticket.on_hold";
export const TICKET_RESUMED_EVENT = "ticket.resumed";

/**
 * RM-25 — SLA Pause/Resume. Emitted by `TicketsService.holdTicket`/
 * `resumeTicket`, mirroring `TicketRecategorizedEvent`'s exact shape and
 * "always emit, let the subscriber decide what (if anything) to do" — the
 * same pattern that keeps `TicketsService` from needing to know anything
 * about `SlaTicketTarget` at all (a different schema, owned by
 * SLA & Automation). `SlaHoldListener` (`sla-policies` module) is the sole
 * subscriber of both — see its own doc comment for the actual pause/resume
 * mechanics, including why a ticket with no `SlaTicketTarget` (no policy
 * ever matched) or already in the target state is a silent no-op rather
 * than an error surfaced back through this event.
 */
export interface TicketOnHoldEvent {
  ticket: TicketSummary;
  actorUserId: string | null;
}

export interface TicketResumedEvent {
  ticket: TicketSummary;
  actorUserId: string | null;
}
