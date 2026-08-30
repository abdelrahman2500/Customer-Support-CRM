import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { PrismaService } from "../../prisma/prisma.service";
import {
  AUTOMATION_RULE_MATCHED_EVENT,
} from "../sla-policies/automation.events";
import type { AutomationRuleMatchedEvent } from "../sla-policies/automation.events";
import { TICKET_UPDATED_EVENT } from "./tickets.events";
import type { TicketUpdatedEvent } from "./tickets.events";
import { toTicketSummary } from "./tickets.service";

/**
 * Story 57 — reacts to the SLA & Automation domain's
 * `automation.rule_matched`, never reads or writes anything outside this
 * module's own `Ticket` table — mirrors `TicketEscalationListener`'s exact
 * "the domain that owns the mutated data performs the mutation" pattern
 * (docs/architecture/03-domain-boundaries.md Rule 1). Re-fetches the ticket
 * by `event.ticketId` rather than trusting any stale state the emitting
 * listener saw. Catch-and-log throughout.
 */
@Injectable()
export class AutomationActionListener {
  private readonly logger = new Logger(AutomationActionListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(AUTOMATION_RULE_MATCHED_EVENT)
  async onAutomationRuleMatched(event: AutomationRuleMatchedEvent): Promise<void> {
    try {
      const ticket = await this.prisma.ticket.findUnique({ where: { id: event.ticketId } });
      if (!ticket || ticket.assignedToUserId) {
        // Already assigned (e.g. an agent claimed it in the meantime, or a
        // second matched event for the same ticket) — never overwrite.
        return;
      }

      const updated = await this.prisma.ticket.update({
        where: { id: event.ticketId },
        data: { assignedToUserId: event.assignToUserId },
      });

      this.eventEmitter.emit(TICKET_UPDATED_EVENT, {
        ticket: toTicketSummary(updated),
        actorUserId: null,
      } satisfies TicketUpdatedEvent);
    } catch (error) {
      this.logger.error(
        "Failed to apply automation rule assignment for automation.rule_matched",
        error as Error,
      );
    }
  }
}
