import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  TICKET_CREATED_EVENT,
  TICKET_UPDATED_EVENT,
  TICKET_RECATEGORIZED_EVENT,
  TICKET_ESCALATED_EVENT,
} from "./tickets.events";
import type {
  TicketCreatedEvent,
  TicketUpdatedEvent,
  TicketRecategorizedEvent,
  TicketEscalatedEvent,
} from "./tickets.events";

/**
 * The first real subscriber to the events `TicketsService` emits (Story 08)
 * — `ticket.created`/`ticket.updated` — later widened (Story 21) to also
 * cover `ticket.recategorized` (Story 16, also emitted by `TicketsService`)
 * and `ticket.escalated` (Story 17, emitted by `TicketEscalationListener`,
 * not `TicketsService` directly), giving the history/timeline complete
 * coverage of every event the Ticketing domain emits. Persistence failures
 * are caught and logged here — never rethrown — so a history-write problem
 * can never turn a successful ticket create/update into a failed HTTP
 * response. Mirrors `AuditInterceptor`'s existing catch-and-log pattern
 * (`apps/api/src/common/audit/audit.interceptor.ts`, "Audit logging must
 * never break the request it's observing").
 */
@Injectable()
export class TicketHistoryListener {
  private readonly logger = new Logger(TicketHistoryListener.name);

  constructor(private readonly prisma: PrismaService) {}

  @OnEvent(TICKET_CREATED_EVENT)
  async onTicketCreated(event: TicketCreatedEvent): Promise<void> {
    await this.record(TICKET_CREATED_EVENT, event);
  }

  @OnEvent(TICKET_UPDATED_EVENT)
  async onTicketUpdated(event: TicketUpdatedEvent): Promise<void> {
    await this.record(TICKET_UPDATED_EVENT, event);
  }

  @OnEvent(TICKET_RECATEGORIZED_EVENT)
  async onTicketRecategorized(event: TicketRecategorizedEvent): Promise<void> {
    await this.record(TICKET_RECATEGORIZED_EVENT, event);
  }

  @OnEvent(TICKET_ESCALATED_EVENT)
  async onTicketEscalated(event: TicketEscalatedEvent): Promise<void> {
    await this.record(TICKET_ESCALATED_EVENT, event);
  }

  private async record(
    eventType: string,
    event: TicketCreatedEvent | TicketUpdatedEvent | TicketRecategorizedEvent | TicketEscalatedEvent,
  ): Promise<void> {
    try {
      await this.prisma.ticketHistoryEntry.create({
        data: {
          ticketId: event.ticket.id,
          actorUserId: event.actorUserId,
          eventType,
          // The full TicketSummary is a plain, JSON-serializable object —
          // this cast only satisfies Prisma's `InputJsonValue` typing
          // (which requires an index signature TicketSummary doesn't
          // declare); the stored value is the snapshot verbatim, unchanged.
          snapshot: event.ticket as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to persist ${eventType} history entry`, error as Error);
    }
  }
}
