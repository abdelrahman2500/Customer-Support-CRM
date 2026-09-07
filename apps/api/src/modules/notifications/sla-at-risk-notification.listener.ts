import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { SLA_AT_RISK_EVENT } from "../sla-policies/sla-detection.events";
import type { SlaAtRiskEvent } from "../sla-policies/sla-detection.events";
import { NotificationPreferencesService } from "./notification-preferences.service";
import { AgentNotificationEmailProducer } from "../../queues/agent-notification-email.producer";

const UNIQUE_CONSTRAINT_VIOLATION = "P2002";

/**
 * The first real reaction to `sla.at_risk` (Story 15) — never `sla.breached`
 * (Story 17 owns that, independently). Persists one `NotificationLog` row,
 * keyed on `(eventType, ticketId, targetType, targetAt)` — not
 * `slaTicketTargetId`, for the identical reason `SlaEscalationListener`
 * (Story 17) already established: that id stays constant across a Story 16
 * recategorization recompute while `targetAt` is what genuinely changes.
 * Catch-and-log throughout: never rethrows, never turns an unrelated
 * request into a failure.
 *
 * RM-26 — once (and only once) a `NotificationLog` row is newly written
 * (never on the caught-`P2002`/already-logged branch), this also resolves
 * the ticket's current `assignedToUserId` and — mirroring
 * `PortalNotificationLogListener.enqueueEmailIfEnabled`'s exact
 * "reuse the existing `inAppEnabled` toggle to gate email too" precedent
 * (RM-19) — enqueues a best-effort notification email once that agent's
 * `sla.at_risk` preference confirms it. Skipped entirely when the ticket
 * has no assignee: nothing here can determine an unassigned ticket's
 * "owner" wants email. Unlike `TicketEscalatedNotificationListener`, this
 * listener already reads `PrismaService` freely (no "no direct Ticketing
 * Prisma access" rule applies to it), so resolving the assignee via one
 * more `Ticket` read is a small, disclosed addition, not a new pattern.
 */
@Injectable()
export class SlaAtRiskNotificationListener {
  private readonly logger = new Logger(SlaAtRiskNotificationListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationPreferencesService: NotificationPreferencesService,
    private readonly agentNotificationEmailProducer: AgentNotificationEmailProducer,
  ) {}

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
      return;
    }
    await this.enqueueEmailIfEnabled(event.ticketId);
  }

  /** RM-26 — never throws: a failure here must never affect the
   * already-successful `NotificationLog` write above, mirroring
   * `PortalNotificationLogListener.enqueueEmailIfEnabled`'s own
   * "log and swallow" convention. */
  private async enqueueEmailIfEnabled(ticketId: string): Promise<void> {
    try {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { assignedToUserId: true },
      });
      const recipientUserId = ticket?.assignedToUserId;
      if (!recipientUserId) {
        return;
      }
      const preferences = await this.notificationPreferencesService.listPreferences(recipientUserId);
      const preference = preferences.find((candidate) => candidate.eventType === SLA_AT_RISK_EVENT);
      if (preference && !preference.inAppEnabled) {
        return;
      }
      await this.agentNotificationEmailProducer.enqueue({
        ticketId,
        eventType: SLA_AT_RISK_EVENT,
        recipientUserId,
      });
    } catch (error) {
      this.logger.error(`Failed to enqueue agent notification email for ticket ${ticketId}`, error as Error);
    }
  }
}
