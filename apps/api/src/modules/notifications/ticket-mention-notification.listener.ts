import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { PrismaService } from "../../prisma/prisma.service";
import { TICKET_MENTIONED_EVENT } from "../tickets/tickets.events";
import type { TicketMentionedEvent } from "../tickets/tickets.events";

/**
 * RM-06 — the first writer of `NotificationLog.recipientUserId`: unlike
 * every prior writer (`SlaAtRiskNotificationListener`/
 * `TicketEscalatedNotificationListener`, both branch-wide), a mention is
 * addressed to exactly one agent. No `dedupeKey`/unique-constraint
 * handling, unlike `TicketEscalatedNotificationListener`: `createTicketNote`
 * is a single synchronous request, not a retried queue job, so there is no
 * realistic double-emission to guard against, and `parseMentions` already
 * deduplicates a person mentioned twice in the same note. Record-only: no
 * template rendering, no delivery — `TicketMentionRealtimeListener` is the
 * separate, sibling reactor for the realtime half, the same
 * write/relay split every existing notification-producing event already
 * uses (e.g. `SlaAtRiskNotificationListener` + `BranchNotificationRealtimeListener`).
 * Catch-and-log: never rethrows, so a persistence failure can never fail
 * the note-creation request it rides in on.
 */
@Injectable()
export class TicketMentionNotificationListener {
  private readonly logger = new Logger(TicketMentionNotificationListener.name);

  constructor(private readonly prisma: PrismaService) {}

  @OnEvent(TICKET_MENTIONED_EVENT)
  async onTicketMentioned(event: TicketMentionedEvent): Promise<void> {
    try {
      await this.prisma.notificationLog.create({
        data: {
          eventType: TICKET_MENTIONED_EVENT,
          ticketId: event.ticketId,
          recipientUserId: event.recipientUserId,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to persist NotificationLog for ${TICKET_MENTIONED_EVENT} (ticket ${event.ticketId}, recipient ${event.recipientUserId})`,
        error as Error,
      );
    }
  }
}
