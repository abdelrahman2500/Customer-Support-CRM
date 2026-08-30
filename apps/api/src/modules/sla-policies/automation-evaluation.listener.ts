import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { PrismaService } from "../../prisma/prisma.service";
import { TICKET_CREATED_EVENT } from "../tickets/tickets.events";
import type { TicketCreatedEvent } from "../tickets/tickets.events";
import { AUTOMATION_RULE_MATCHED_EVENT } from "./automation.events";
import type { AutomationRuleMatchedEvent } from "./automation.events";

/**
 * Reacts to `ticket.created` (Ticketing's event) — mirrors
 * `SlaTargetListener.onTicketCreated`'s exact "re-fetch the ticket by id,
 * catch-and-log" pattern. Never writes to `Ticket` itself: on a match, this
 * emits `AUTOMATION_RULE_MATCHED_EVENT` and lets `TicketsModule`'s own
 * `AutomationActionListener` perform the actual write (Design decision 6 —
 * the domain that owns the mutated data performs the mutation).
 */
@Injectable()
export class AutomationEvaluationListener {
  private readonly logger = new Logger(AutomationEvaluationListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(TICKET_CREATED_EVENT)
  async onTicketCreated(event: TicketCreatedEvent): Promise<void> {
    try {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: event.ticket.id },
        select: { branchId: true, category: true, assignedToUserId: true },
      });
      if (!ticket) {
        return;
      }
      // Automation never overrides an explicit assignment (Design decision 5)
      // — a caller can already set `assignedToUserId` directly on creation
      // (Story 43).
      if (ticket.assignedToUserId) {
        return;
      }

      const matchedRule = await this.resolveMatchingRule(ticket.branchId, ticket.category);
      if (!matchedRule) {
        return;
      }

      this.eventEmitter.emit(AUTOMATION_RULE_MATCHED_EVENT, {
        ticketId: event.ticket.id,
        ruleId: matchedRule.id,
        assignToUserId: matchedRule.actionAssignToUserId,
      } satisfies AutomationRuleMatchedEvent);
    } catch (error) {
      this.logger.error("Failed to evaluate automation rules for ticket.created", error as Error);
    }
  }

  /**
   * First-match-wins, ordered `createdAt` ascending (Design decision 4) — a
   * category-specific rule and a wildcard (`conditionCategory: null`) rule
   * are otherwise equally eligible; the `OR` filter shape mirrors
   * `SlaTargetListener.resolveBestPolicy`'s own category dimension exactly.
   */
  private async resolveMatchingRule(
    branchId: string,
    category: string | null,
  ): Promise<{ id: string; actionAssignToUserId: string } | null> {
    const categoryFilter = category
      ? { OR: [{ conditionCategory: null }, { conditionCategory: category }] }
      : { conditionCategory: null };

    const rule = await this.prisma.automationRule.findFirst({
      where: { branchId, isActive: true, ...categoryFilter },
      orderBy: { createdAt: "asc" },
      select: { id: true, actionAssignToUserId: true },
    });
    return rule;
  }
}
