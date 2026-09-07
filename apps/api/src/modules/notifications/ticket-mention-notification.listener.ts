import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { PrismaService } from "../../prisma/prisma.service";
import { TICKET_MENTIONED_EVENT } from "../tickets/tickets.events";
import type { TicketMentionedEvent } from "../tickets/tickets.events";
import { AgentNotificationEmailProducer } from "../../queues/agent-notification-email.producer";

/**
 * RM-06 — the first writer of `NotificationLog.recipientUserId`: unlike
 * every prior writer (`SlaAtRiskNotificationListener`/
 * `TicketEscalatedNotificationListener`, both branch-wide), a mention is
 * addressed to exactly one agent. No `dedupeKey`/unique-constraint
 * handling, unlike `TicketEscalatedNotificationListener`: `createTicketNote`
 * is a single synchronous request, not a retried queue job, so there is no
 * realistic double-emission to guard against, and `parseMentions` already
 * deduplicates a person mentioned twice in the same note. In-app delivery
 * only — `TicketMentionRealtimeListener` is the separate, sibling reactor
 * for the realtime half, the same write/relay split every existing
 * notification-producing event already uses (e.g.
 * `SlaAtRiskNotificationListener` + `BranchNotificationRealtimeListener`).
 * Catch-and-log: never rethrows, so a persistence failure can never fail
 * the note-creation request it rides in on.
 *
 * RM-26 — once the `NotificationLog` row is persisted, this also enqueues a
 * best-effort notification email to `event.recipientUserId`, unconditionally
 * — unlike `SlaAtRiskNotificationListener`/`TicketEscalatedNotificationListener`,
 * `ticket.mentioned` is not one of `NOTIFICATION_EVENT_TYPES`
 * (`notification-preferences.service.ts`), so there is no `inAppEnabled`
 * toggle to check here, exactly mirroring how a mention already bypasses
 * every preference/gating mechanism for its in-app delivery today.
 */
@Injectable()
export class TicketMentionNotificationListener {
  private readonly logger = new Logger(TicketMentionNotificationListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly agentNotificationEmailProducer: AgentNotificationEmailProducer,
  ) {}

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
      return;
    }
    // RM-26 — never throws: a failure here must never affect the
    // already-successful `NotificationLog` write above.
    try {
      await this.agentNotificationEmailProducer.enqueue({
        ticketId: event.ticketId,
        eventType: TICKET_MENTIONED_EVENT,
        recipientUserId: event.recipientUserId,
      });
    } catch (error) {
      this.logger.error(
        `Failed to enqueue agent notification email for ticket ${event.ticketId}`,
        error as Error,
      );
    }
  }
}
