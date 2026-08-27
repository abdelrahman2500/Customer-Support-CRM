import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { SLA_AT_RISK_EVENT } from "../sla-policies/sla-detection.events";
import type { SlaAtRiskEvent } from "../sla-policies/sla-detection.events";

const UNIQUE_CONSTRAINT_VIOLATION = "P2002";

/**
 * The first real reaction to `sla.at_risk` (Story 15) — never `sla.breached`
 * (Story 17 owns that, independently). Persists one `NotificationLog` row,
 * keyed on `(eventType, ticketId, targetType, targetAt)` — not
 * `slaTicketTargetId`, for the identical reason `SlaEscalationListener`
 * (Story 17) already established: that id stays constant across a Story 16
 * recategorization recompute while `targetAt` is what genuinely changes.
 * This is a record-only reaction — no recipient resolution, no template
 * rendering, no delivery, no follow-on event. Catch-and-log throughout:
 * never rethrows, never turns an unrelated request into a failure.
 */
@Injectable()
export class SlaAtRiskNotificationListener {
  private readonly logger = new Logger(SlaAtRiskNotificationListener.name);

  constructor(private readonly prisma: PrismaService) {}

  @OnEvent(SLA_AT_RISK_EVENT)
  async onSlaAtRisk(event: SlaAtRiskEvent): Promise<void> {
    try {
      await this.prisma.notificationLog.create({
        data: {
          eventType: SLA_AT_RISK_EVENT,
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
          `Ticket ${event.ticketId} already has a logged at-risk notification for ${event.targetType} target at ${event.targetAt.toISOString()}`,
        );
        return;
      }
      this.logger.error("Failed to persist NotificationLog for sla.at_risk", error as Error);
    }
  }
}
