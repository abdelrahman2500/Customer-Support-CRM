import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { SLA_BREACHED_EVENT, SLA_ESCALATED_EVENT } from "./sla-detection.events";
import type { SlaBreachedEvent, SlaEscalatedEvent } from "./sla-detection.events";

const UNIQUE_CONSTRAINT_VIOLATION = "P2002";

/**
 * The first real reaction to `sla.breached` (Story 15) — never `sla.at_risk`
 * (Design item 1). Persists one `SlaEscalation` row, keyed on
 * `(ticketId, targetType, targetAt)` — not `slaTicketTargetId`, since that
 * id stays constant across a Story 16 recategorization recompute while
 * `targetAt` is what genuinely changes (Design item 2). On success, emits
 * `sla.escalated` so the `tickets` module — not this one — is the only code
 * that ever emits the Ticketing-owned `ticket.escalated` (Design item 4).
 * Catch-and-log throughout: never rethrows, never turns an unrelated
 * request into a failure.
 */
@Injectable()
export class SlaEscalationListener {
  private readonly logger = new Logger(SlaEscalationListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(SLA_BREACHED_EVENT)
  async onSlaBreached(event: SlaBreachedEvent): Promise<void> {
    try {
      await this.prisma.slaEscalation.create({
        data: {
          ticketId: event.ticketId,
          branchId: event.branchId,
          targetType: event.targetType,
          targetAt: event.targetAt,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_CONSTRAINT_VIOLATION
      ) {
        this.logger.log(
          `Ticket ${event.ticketId} already escalated for ${event.targetType} target at ${event.targetAt.toISOString()}`,
        );
        return;
      }
      this.logger.error("Failed to persist SlaEscalation for sla.breached", error as Error);
      return;
    }

    this.eventEmitter.emit(SLA_ESCALATED_EVENT, {
      ticketId: event.ticketId,
      branchId: event.branchId,
      targetType: event.targetType,
      targetAt: event.targetAt,
    } satisfies SlaEscalatedEvent);
  }
}
