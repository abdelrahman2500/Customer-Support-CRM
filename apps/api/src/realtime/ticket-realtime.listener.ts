import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { RealtimeGateway } from "./realtime.gateway";
import {
  TICKET_UPDATED_EVENT,
  TICKET_ESCALATED_EVENT,
  TICKET_NOTE_ADDED_EVENT,
} from "../modules/tickets/tickets.events";
import type {
  TicketUpdatedEvent,
  TicketEscalatedEvent,
  TicketNoteAddedEvent,
} from "../modules/tickets/tickets.events";
import { AI_PROMPT_COMPLETED_EVENT } from "../modules/ai/ai.events";
import type { AiPromptCompletedEvent } from "../modules/ai/ai.events";

/**
 * Relays already-existing domain events into the `ticket:{id}` room —
 * Design item 10. Broadcasts the domain event's own payload verbatim, no new
 * DTO. Neither `TicketsService` nor `TicketEscalationListener` is modified —
 * this listener only subscribes. Structurally mirrors
 * `TicketEscalationListener` (Context item 8): `@Injectable()`, one
 * `@OnEvent` handler per event, try/catch, `Logger.error` on failure, never
 * rethrows.
 *
 * Story 50 — a third handler for `ticket.note-added`, whose payload shape
 * (`{ ticketId, note }`) deliberately differs from the other two events'
 * shared `{ ticket, actorUserId }` shape (see that event's own doc comment)
 * — `relay()` itself is unchanged, since it was already event-name/payload-
 * agnostic.
 *
 * Story 76 — a fourth handler for `ai.prompt_completed`
 * (apps/api/src/modules/ai/ai.events.ts), emitted by
 * `AiProcessingEventsBridgeProcessor` once `apps/worker` resolves an AI
 * ticket-assist operation. Same `relay()` path, same room — no new
 * realtime room/gateway/authorization mechanism.
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

  @OnEvent(TICKET_NOTE_ADDED_EVENT)
  onTicketNoteAdded(event: TicketNoteAddedEvent): void {
    this.relay(TICKET_NOTE_ADDED_EVENT, event.ticketId, event);
  }

  @OnEvent(AI_PROMPT_COMPLETED_EVENT)
  onAiPromptCompleted(event: AiPromptCompletedEvent): void {
    this.relay(AI_PROMPT_COMPLETED_EVENT, event.ticketId, event);
  }

  private relay(eventName: string, ticketId: string, payload: unknown): void {
    try {
      this.gateway.server.to(`ticket:${ticketId}`).emit(eventName, payload);
    } catch (error) {
      this.logger.error(`Failed to relay ${eventName} for ticket ${ticketId}`, error as Error);
    }
  }
}
