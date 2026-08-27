import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { RealtimeGateway } from "./realtime.gateway";
import { TICKET_UPDATED_EVENT, TICKET_ESCALATED_EVENT } from "../modules/tickets/tickets.events";
import type { TicketUpdatedEvent, TicketEscalatedEvent } from "../modules/tickets/tickets.events";

/**
 * Relays exactly two already-existing domain events into the `ticket:{id}`
 * room — Design item 10. Broadcasts the domain event's own payload
 * verbatim, no new DTO. Neither `TicketsService` nor
 * `TicketEscalationListener` is modified — this listener only subscribes.
 * Structurally mirrors `TicketEscalationListener` (Context item 8):
 * `@Injectable()`, one `@OnEvent` handler per event, try/catch,
 * `Logger.error` on failure, never rethrows.
 */
@Injectable()
export class TicketRealtimeListener {
  private readonly logger = new Logger(TicketRealtimeListener.name);

  constructor(private readonly gateway: RealtimeGateway) {}

  @OnEvent(TICKET_UPDATED_EVENT)
  onTicketUpdated(event: TicketUpdatedEvent): void {
    this.relay(TICKET_UPDATED_EVENT, event.ticket.id, event);
  }

  @OnEvent(TICKET_ESCALATED_EVENT)
  onTicketEscalated(event: TicketEscalatedEvent): void {
    this.relay(TICKET_ESCALATED_EVENT, event.ticket.id, event);
  }

  private relay(eventName: string, ticketId: string, payload: unknown): void {
    try {
      this.gateway.server.to(`ticket:${ticketId}`).emit(eventName, payload);
    } catch (error) {
      this.logger.error(`Failed to relay ${eventName} for ticket ${ticketId}`, error as Error);
    }
  }
}
