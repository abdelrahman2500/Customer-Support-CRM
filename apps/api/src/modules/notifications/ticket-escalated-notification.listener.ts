import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { TICKET_ESCALATED_EVENT } from "../tickets/tickets.events";
import type { TicketEscalatedEvent } from "../tickets/tickets.events";
import { NotificationPreferencesService } from "./notification-preferences.service";
import { AgentNotificationEmailProducer } from "../../queues/agent-notification-email.producer";

const UNIQUE_CONSTRAINT_VIOLATION = "P2002";

/**
 * The second reaction in the `Notifications` domain (after
 * `SlaAtRiskNotificationListener`, Story 18) — the first real consumer of
 * `ticket.escalated` (Story 17). `TicketEscalatedEvent` carries no
 * `branchId`/`targetType`/`targetAt` (unlike the SLA detection events), so
 * this listener never touches those columns and never queries `Ticket` via
 * Prisma — it relies solely on the event payload, per this story's own
 * (stricter than prior stories') "no direct Ticketing Prisma access" rule.
 * Idempotency is `(eventType, dedupeKey)`, with `dedupeKey` set to the
 * ticket id — `NotificationLog`'s existing SLA-specific constraint cannot
 * express this event's identity, since Postgres never treats two `NULL`
 * `targetType`/`targetAt` values as equal (Design item 2). Catch-and-log
 * throughout: never rethrows.
 *
 * RM-26 — once (and only once) a `NotificationLog` row is newly written
 * (never on the caught-`P2002`/already-logged branch), this also enqueues a
 * best-effort notification email to `event.ticket.assignedToUserId` —
 * already present on the event payload (`TicketSummary`), so the "no direct
 * Ticketing Prisma access" rule above stays intact — once that agent's
 * `ticket.escalated` preference confirms it (mirrors
 * `PortalNotificationLogListener.enqueueEmailIfEnabled`'s exact "reuse the
 * existing `inAppEnabled` toggle to gate email too" precedent, RM-19).
 * Skipped entirely when the ticket has no assignee.
 */
@Injectable()
export class TicketEscalatedNotificationListener {
  private readonly logger = new Logger(TicketEscalatedNotificationListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationPreferencesService: NotificationPreferencesService,
    private readonly agentNotificationEmailProducer: AgentNotificationEmailProducer,
  ) {}

  @OnEvent(TICKET_ESCALATED_EVENT)
  async onTicketEscalated(event: TicketEscalatedEvent): Promise<void> {
    try {
      await this.prisma.notificationLog.create({
        data: {
          eventType: TICKET_ESCALATED_EVENT,
          ticketId: event.ticket.id,
          dedupeKey: event.ticket.id,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_CONSTRAINT_VIOLATION
      ) {
        this.logger.log(`Ticket ${event.ticket.id} already has a logged escalation notification`);
        return;
      }
      this.logger.error("Failed to persist NotificationLog for ticket.escalated", error as Error);
      return;
    }
    await this.enqueueEmailIfEnabled(event.ticket.id, event.ticket.assignedToUserId);
  }

  /** RM-26 — never throws: a failure here must never affect the
   * already-successful `NotificationLog` write above, mirroring
   * `PortalNotificationLogListener.enqueueEmailIfEnabled`'s own
   * "log and swallow" convention. */
  private async enqueueEmailIfEnabled(
    ticketId: string,
    recipientUserId: string | null,
  ): Promise<void> {
    if (!recipientUserId) {
      return;
    }
    try {
      const preferences = await this.notificationPreferencesService.listPreferences(recipientUserId);
      const preference = preferences.find((candidate) => candidate.eventType === TICKET_ESCALATED_EVENT);
      if (preference && !preference.inAppEnabled) {
        return;
      }
      await this.agentNotificationEmailProducer.enqueue({
        ticketId,
        eventType: TICKET_ESCALATED_EVENT,
        recipientUserId,
      });
    } catch (error) {
      this.logger.error(`Failed to enqueue agent notification email for ticket ${ticketId}`, error as Error);
    }
  }
}
