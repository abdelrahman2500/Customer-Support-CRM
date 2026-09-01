import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { RealtimeGateway } from "./realtime.gateway";
import { PrismaService } from "../prisma/prisma.service";
import { TICKET_UPDATED_EVENT } from "../modules/tickets/tickets.events";
import type { TicketUpdatedEvent } from "../modules/tickets/tickets.events";
import { CHANNEL_MESSAGE_CREATED_EVENT } from "../modules/channels/channel-messages.events";
import type { ChannelMessageCreatedEvent } from "../modules/channels/channel-messages.events";

/**
 * Story 86 — the Customer Portal's first notification-delivery reaction,
 * mirroring `BranchNotificationRealtimeListener`'s exact shape (one
 * `@OnEvent` handler per event, a shared synchronous `relay()` helper,
 * try/catch, `Logger.error` on failure, never rethrows) but relaying into
 * `customer:{customerId}:notifications` (`RealtimeGateway.authorizeRoom`'s
 * own new Story 86 branch) instead of a branch-wide room. Fully
 * independent of `TicketRealtimeListener`/`ticket:{id}` — neither this
 * story's room, nor this listener, changes anything about that existing
 * room or its own listener.
 *
 * Both relayed events are already fully readable by the ticket's own
 * customer today (`GET /portal/tickets/:id`, `GET
 * /portal/tickets/:id/messages`) — this widens *reach* into a room that
 * doesn't require already being on that one ticket's page, it introduces
 * no new exposure.
 */
@Injectable()
export class CustomerNotificationRealtimeListener {
  private readonly logger = new Logger(CustomerNotificationRealtimeListener.name);

  constructor(
    private readonly gateway: RealtimeGateway,
    private readonly prisma: PrismaService,
  ) {}

  /** `TicketUpdatedEvent.ticket.customerId` is already on the payload —
   * no Prisma lookup needed, relay is synchronous. Unconditional: every
   * `ticket.updated` (status, assignment, recategorization, etc.) is
   * relayed, mirroring `BranchNotificationRealtimeListener`'s own
   * "no filtering, always relay" precedent for a synchronous event. */
  @OnEvent(TICKET_UPDATED_EVENT)
  onTicketUpdated(event: TicketUpdatedEvent): void {
    this.relay(TICKET_UPDATED_EVENT, event.ticket.customerId, event);
  }

  /**
   * Relays only when `message.senderUserId` is set — the one signal that
   * `createOutboundFromUser` (a real agent reply), not
   * `createInboundFromContact` (the customer's own message — no
   * self-notify) or `createSystemMessage` (Story 85's AI-chat transcript
   * replay — historical messages the customer already read in the chat
   * widget), produced this message. The payload carries no `customerId`,
   * so one Prisma lookup resolves it first — mirrors
   * `BranchNotificationRealtimeListener.onTicketEscalated`'s identical
   * pattern (ticket not found → no relay; Prisma throws → catch-and-log,
   * never rethrow).
   */
  @OnEvent(CHANNEL_MESSAGE_CREATED_EVENT)
  async onChannelMessageCreated(event: ChannelMessageCreatedEvent): Promise<void> {
    if (!event.message.senderUserId) {
      return;
    }
    try {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: event.ticketId },
        select: { customerId: true },
      });
      if (!ticket) {
        return;
      }
      this.relay(CHANNEL_MESSAGE_CREATED_EVENT, ticket.customerId, event);
    } catch (error) {
      this.logger.error(`Failed to resolve customer for ticket ${event.ticketId}`, error as Error);
    }
  }

  private relay(eventName: string, customerId: string, payload: unknown): void {
    try {
      this.gateway.server.to(`customer:${customerId}:notifications`).emit(eventName, payload);
    } catch (error) {
      this.logger.error(`Failed to relay ${eventName} for customer ${customerId}`, error as Error);
    }
  }
}
