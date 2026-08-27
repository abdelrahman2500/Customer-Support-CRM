import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { TICKET_ESCALATED_EVENT } from "../tickets/tickets.events";
import type { TicketEscalatedEvent } from "../tickets/tickets.events";

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
 * `targetType`/`targetAt` values as equal (Design item 2). Record-only: no
 * recipient resolution, no template rendering, no delivery, no follow-on
 * event. Catch-and-log throughout: never rethrows.
 */
@Injectable()
export class TicketEscalatedNotificationListener {
  private readonly logger = new Logger(TicketEscalatedNotificationListener.name);

  constructor(private readonly prisma: PrismaService) {}

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
    }
  }
}
