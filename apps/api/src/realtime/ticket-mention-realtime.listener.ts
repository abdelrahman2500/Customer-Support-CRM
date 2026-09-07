import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { RealtimeGateway } from "./realtime.gateway";
import { TICKET_MENTIONED_EVENT } from "../modules/tickets/tickets.events";
import type { TicketMentionedEvent } from "../modules/tickets/tickets.events";

/**
 * RM-06 — relays `ticket.mentioned` (emitted by
 * `TicketsService.createTicketNote` once its own bounded `parseMentions`
 * resolves an `@mention` to a real branch agent) into
 * `agent:{recipientUserId}:notifications` — a room only that one agent can
 * ever join (`RealtimeGateway.authorizeRoom`'s own `agent:(.+):notifications`
 * case, own-id only, mirrors `agent:(.+):tasks`'s exact authorization
 * shape). Structurally mirrors `TaskRealtimeListener`: one `@OnEvent`
 * handler, a synchronous `relay()`, try/catch, `Logger.error` on failure,
 * never rethrows. Independent of `TicketMentionNotificationListener` (the
 * sibling reactor that persists the `NotificationLog` row) — the same
 * write/relay split every existing notification-producing event already
 * uses in this codebase.
 */
@Injectable()
export class TicketMentionRealtimeListener {
  private readonly logger = new Logger(TicketMentionRealtimeListener.name);

  constructor(private readonly gateway: RealtimeGateway) {}

  @OnEvent(TICKET_MENTIONED_EVENT)
  onTicketMentioned(event: TicketMentionedEvent): void {
    try {
      this.gateway.server
        .to(`agent:${event.recipientUserId}:notifications`)
        .emit(TICKET_MENTIONED_EVENT, event);
    } catch (error) {
      this.logger.error(
        `Failed to relay ${TICKET_MENTIONED_EVENT} for ticket ${event.ticketId}`,
        error as Error,
      );
    }
  }
}
