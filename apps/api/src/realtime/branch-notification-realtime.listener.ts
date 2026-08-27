import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { RealtimeGateway } from "./realtime.gateway";
import { PrismaService } from "../prisma/prisma.service";
import {
  SLA_AT_RISK_EVENT,
  SLA_BREACHED_EVENT,
} from "../modules/sla-policies/sla-detection.events";
import type { SlaAtRiskEvent, SlaBreachedEvent } from "../modules/sla-policies/sla-detection.events";
import { TICKET_ESCALATED_EVENT } from "../modules/tickets/tickets.events";
import type { TicketEscalatedEvent } from "../modules/tickets/tickets.events";

/**
 * Relays three already-existing domain events into `branch:{id}:notifications`
 * (Story 20) — the approved first iteration of in-app notification delivery:
 * branch-wide, non-targeted broadcast, no recipient resolution (Design
 * items 1–4). Structurally mirrors `TicketRealtimeListener`: one `@OnEvent`
 * handler per event, a shared synchronous `relay()` helper, try/catch,
 * `Logger.error` on failure, never rethrows. Does not read or write
 * `NotificationLog` — entirely independent of `SlaAtRiskNotificationListener`/
 * `TicketEscalatedNotificationListener` (Design item 5).
 */
@Injectable()
export class BranchNotificationRealtimeListener {
  private readonly logger = new Logger(BranchNotificationRealtimeListener.name);

  constructor(
    private readonly gateway: RealtimeGateway,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent(SLA_AT_RISK_EVENT)
  onSlaAtRisk(event: SlaAtRiskEvent): void {
    this.relay(SLA_AT_RISK_EVENT, event.branchId, event);
  }

  @OnEvent(SLA_BREACHED_EVENT)
  onSlaBreached(event: SlaBreachedEvent): void {
    this.relay(SLA_BREACHED_EVENT, event.branchId, event);
  }

  @OnEvent(TICKET_ESCALATED_EVENT)
  async onTicketEscalated(event: TicketEscalatedEvent): Promise<void> {
    try {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: event.ticket.id },
        select: { branchId: true },
      });
      if (!ticket) {
        return;
      }
      this.relay(TICKET_ESCALATED_EVENT, ticket.branchId, event);
    } catch (error) {
      this.logger.error(`Failed to resolve branch for ticket ${event.ticket.id}`, error as Error);
    }
  }

  private relay(eventName: string, branchId: string, payload: unknown): void {
    try {
      this.gateway.server.to(`branch:${branchId}:notifications`).emit(eventName, payload);
    } catch (error) {
      this.logger.error(`Failed to relay ${eventName} for branch ${branchId}`, error as Error);
    }
  }
}
