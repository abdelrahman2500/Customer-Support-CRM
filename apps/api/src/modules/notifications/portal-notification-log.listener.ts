import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { TICKET_UPDATED_EVENT } from "../tickets/tickets.events";
import type { TicketUpdatedEvent } from "../tickets/tickets.events";
import { CHANNEL_MESSAGE_CREATED_EVENT } from "../channels/channel-messages.events";
import type { ChannelMessageCreatedEvent } from "../channels/channel-messages.events";

const UNIQUE_CONSTRAINT_VIOLATION = "P2002";

/**
 * Story 88 — the persisting counterpart of
 * `apps/api/src/realtime/customer-notification-realtime.listener.ts`
 * (Story 86), which only *relays* these two events live and persists
 * nothing. Mirrors `TicketEscalatedNotificationListener`'s exact
 * "record-only, `dedupeKey`-based idempotency, catch-and-log, never
 * rethrow" shape — the same split this codebase's agent-side notifications
 * already use twice over (`ticket.escalated` has both a persisting
 * listener here and a relaying listener in `realtime/`).
 *
 * Every written row sets `customerId` (never `branchId`/`targetType`/
 * `targetAt`, which stay `null` — those columns belong to the SLA-timer
 * events, not these) so `NotificationsService.listNotificationsForCustomer`
 * can filter directly and `listNotifications()` (agent-facing) can exclude
 * these rows with a plain `customerId: null` filter.
 */
@Injectable()
export class PortalNotificationLogListener {
  private readonly logger = new Logger(PortalNotificationLogListener.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Unconditional — mirrors `CustomerNotificationRealtimeListener.
   * onTicketUpdated`'s own "no filtering, always relay" precedent.
   * `dedupeKey` is `ticketId:updatedAt`, unique per actual row change
   * (`Ticket.updatedAt` changes on every `TicketsService.updateTicket`
   * call), so a caught `P2002` means "already logged this exact update." */
  @OnEvent(TICKET_UPDATED_EVENT)
  async onTicketUpdated(event: TicketUpdatedEvent): Promise<void> {
    try {
      await this.prisma.notificationLog.create({
        data: {
          eventType: TICKET_UPDATED_EVENT,
          ticketId: event.ticket.id,
          customerId: event.ticket.customerId,
          dedupeKey: `${event.ticket.id}:${event.ticket.updatedAt.toISOString()}`,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_CONSTRAINT_VIOLATION
      ) {
        this.logger.log(`Ticket ${event.ticket.id} already has a logged update at ${event.ticket.updatedAt.toISOString()}`);
        return;
      }
      this.logger.error("Failed to persist NotificationLog for ticket.updated", error as Error);
    }
  }

  /**
   * Records only when `message.senderUserId` is set — identical filter to
   * `CustomerNotificationRealtimeListener.onChannelMessageCreated`, for the
   * identical reason (no self-notify on the customer's own message; no
   * duplicate-of-something-already-read for Story 85's AI-chat transcript
   * replay). `dedupeKey` is the message id (globally unique — one
   * `ChannelMessage` row can never fire this event twice).
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
      await this.prisma.notificationLog.create({
        data: {
          eventType: CHANNEL_MESSAGE_CREATED_EVENT,
          ticketId: event.ticketId,
          customerId: ticket.customerId,
          dedupeKey: event.message.id,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_CONSTRAINT_VIOLATION
      ) {
        this.logger.log(`Message ${event.message.id} already has a logged notification`);
        return;
      }
      this.logger.error("Failed to persist NotificationLog for channel.message.created", error as Error);
    }
  }
}
