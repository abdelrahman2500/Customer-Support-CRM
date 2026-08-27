import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { PrismaService } from "../../prisma/prisma.service";
import { SLA_ESCALATED_EVENT } from "../sla-policies/sla-detection.events";
import type { SlaEscalatedEvent } from "../sla-policies/sla-detection.events";
import { TICKET_ESCALATED_EVENT } from "./tickets.events";
import type { TicketEscalatedEvent } from "./tickets.events";
import { toTicketSummary } from "./tickets.service";

/**
 * The only code in this story that emits `ticket.escalated` — Ticketing's
 * own event, per docs/architecture/03-domain-boundaries.md:9 (Design item
 * 4). Reacts to the SLA & Automation domain's `sla.escalated`, never reads
 * or writes anything outside this module's own `Ticket` table. Re-fetches
 * by `event.ticketId` rather than trusting any client-supplied data — the
 * same re-fetch-by-id convention `SlaTargetListener` already uses, just in
 * the opposite module direction. Catch-and-log throughout.
 */
@Injectable()
export class TicketEscalationListener {
  private readonly logger = new Logger(TicketEscalationListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(SLA_ESCALATED_EVENT)
  async onSlaEscalated(event: SlaEscalatedEvent): Promise<void> {
    try {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: event.ticketId },
        select: {
          id: true,
          subject: true,
          category: true,
          priority: true,
          status: true,
          customerId: true,
          contactId: true,
          departmentId: true,
          assignedToUserId: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      if (!ticket) {
        return;
      }

      this.eventEmitter.emit(TICKET_ESCALATED_EVENT, {
        ticket: toTicketSummary(ticket),
        actorUserId: null,
      } satisfies TicketEscalatedEvent);
    } catch (error) {
      this.logger.error("Failed to emit ticket.escalated for sla.escalated", error as Error);
    }
  }
}
