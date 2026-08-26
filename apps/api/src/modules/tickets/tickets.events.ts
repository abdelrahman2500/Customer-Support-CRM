import type { TicketSummary } from "./tickets.service";

export const TICKET_CREATED_EVENT = "ticket.created";
export const TICKET_UPDATED_EVENT = "ticket.updated";

/** Emitted once, after `TicketsService.createTicket` successfully persists the row. */
export interface TicketCreatedEvent {
  ticket: TicketSummary;
}

/** Emitted once, after `TicketsService.updateTicket` successfully persists the row. */
export interface TicketUpdatedEvent {
  ticket: TicketSummary;
}
