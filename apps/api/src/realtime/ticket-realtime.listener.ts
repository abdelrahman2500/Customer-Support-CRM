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
import { CHANNEL_MESSAGE_CREATED_EVENT } from "../modules/channels/channel-messages.events";
import type { ChannelMessageCreatedEvent } from "../modules/channels/channel-messages.events";

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
 *
 * Story 77 — Customer Portal Live Chat. `ticket:{id}` may now also
 * contain the ticket's own customer (see `RealtimeGateway`'s own doc
 * comment). `ticket.escalated`/`ticket.note-added`/`ai.prompt_completed`
 * carry internal-only content (an internal note; SLA/AI-tooling state
 * never exposed via the Portal's REST surface) — those three now route
 * through `gateway.emitToAgentsInRoom` instead of the plain whole-room
 * `relay()`, so a customer sharing the room never receives them.
 * `ticket.updated` stays on the plain broadcast: its `TicketSummary`
 * payload is already fully readable by the ticket's own customer via
 * `GET /portal/tickets/:id`, so routing it to the whole room introduces
 * no new exposure. `channel.message.created` (new) is exactly the one
 * event meant for both audiences, so it also stays on the plain
 * broadcast.
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
    this.relayToAgents(TICKET_ESCALATED_EVENT, event.ticket.id, event);
  }

  @OnEvent(TICKET_NOTE_ADDED_EVENT)
  onTicketNoteAdded(event: TicketNoteAddedEvent): void {
    this.relayToAgents(TICKET_NOTE_ADDED_EVENT, event.ticketId, event);
  }

  @OnEvent(AI_PROMPT_COMPLETED_EVENT)
  onAiPromptCompleted(event: AiPromptCompletedEvent): void {
    this.relayToAgents(AI_PROMPT_COMPLETED_EVENT, event.ticketId, event);
  }

  @OnEvent(CHANNEL_MESSAGE_CREATED_EVENT)
  onChannelMessageCreated(event: ChannelMessageCreatedEvent): void {
    this.relay(CHANNEL_MESSAGE_CREATED_EVENT, event.ticketId, event);
  }

  private relay(eventName: string, ticketId: string, payload: unknown): void {
    try {
      this.gateway.server.to(`ticket:${ticketId}`).emit(eventName, payload);
    } catch (error) {
      this.logger.error(`Failed to relay ${eventName} for ticket ${ticketId}`, error as Error);
    }
  }

  /** `emitToAgentsInRoom` already catches and logs its own failures — no
   * further try/catch needed here. */
  private relayToAgents(eventName: string, ticketId: string, payload: unknown): void {
    void this.gateway.emitToAgentsInRoom(`ticket:${ticketId}`, eventName, payload);
  }
}
