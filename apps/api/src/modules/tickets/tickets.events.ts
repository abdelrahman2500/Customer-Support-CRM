import type { TicketNoteSummary, TicketSummary } from "./tickets.service";

export const TICKET_CREATED_EVENT = "ticket.created";
export const TICKET_UPDATED_EVENT = "ticket.updated";

/** Emitted once, after `TicketsService.createTicket` successfully persists the row. */
export interface TicketCreatedEvent {
  ticket: TicketSummary;
  actorUserId: string | null;
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
