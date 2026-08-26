import type { TicketSummary } from "./tickets.service";

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
