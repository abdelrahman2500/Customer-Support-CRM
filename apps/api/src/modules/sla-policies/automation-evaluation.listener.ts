import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import type { AutomationActionAssignmentMode } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { TICKET_CREATED_EVENT } from "../tickets/tickets.events";
import type { TicketCreatedEvent } from "../tickets/tickets.events";
import { AUTOMATION_RULE_MATCHED_EVENT } from "./automation.events";
import type { AutomationRuleMatchedEvent } from "./automation.events";

const OPEN_TICKET_STATUSES = ["OPEN", "IN_PROGRESS"] as const;

/**
 * Reacts to `ticket.created` (Ticketing's event) — mirrors
 * `SlaTargetListener.onTicketCreated`'s exact "re-fetch the ticket by id,
 * catch-and-log" pattern. Never writes to `Ticket` itself: on a match, this
 * emits `AUTOMATION_RULE_MATCHED_EVENT` and lets `TicketsModule`'s own
 * `AutomationActionListener` perform the actual write (Design decision 6 —
 * the domain that owns the mutated data performs the mutation).
 *
 * RM-24 — `resolveAssignee` below is the ONE place `LEAST_LOADED`
 * resolution happens: `AutomationRuleMatchedEvent.assignToUserId` stays a
 * single, already-resolved user id regardless of which mode matched,
 * exactly as it always has — `AutomationActionListener` needs no changes
 * at all and stays completely unaware assignment modes exist.
 *
 * RM-29 — `event.priorityExplicit` (from `TicketCreatedEvent`, computed
 * once at creation time) is passed straight through to
 * `AUTOMATION_RULE_MATCHED_EVENT` unchanged — never re-derived here, since
 * nothing about the matched rule or this listener's own re-fetched
 * `Ticket` row can answer "was this ticket's priority ever explicitly
 * chosen?" after the fact (see `AutomationRule.actionSetPriority`'s own
 * schema doc comment).
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
        select: { branchId: true, categoryId: true, assignedToUserId: true },
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

      const matchedRule = await this.resolveMatchingRule(ticket.branchId, ticket.categoryId);
      if (!matchedRule) {
        return;
      }

      const assignToUserId = await this.resolveAssignee(matchedRule);

      this.eventEmitter.emit(AUTOMATION_RULE_MATCHED_EVENT, {
        ticketId: event.ticket.id,
        ruleId: matchedRule.id,
        assignToUserId,
        setCategoryId: matchedRule.actionSetCategoryId,
        setDepartmentId: matchedRule.actionSetDepartmentId,
        setPriority: matchedRule.actionSetPriority,
        priorityExplicit: event.priorityExplicit,
      } satisfies AutomationRuleMatchedEvent);
    } catch (error) {
      this.logger.error("Failed to evaluate automation rules for ticket.created", error as Error);
    }
  }

  /**
   * First-match-wins, ordered `createdAt` ascending (Design decision 4) — a
   * category-specific rule and a wildcard (`conditionCategoryId: null`)
   * rule are otherwise equally eligible; the `OR` filter shape mirrors
   * `SlaTargetListener.resolveBestPolicy`'s own category dimension exactly.
   */
  private async resolveMatchingRule(
    branchId: string,
    categoryId: string | null,
  ): Promise<{
    id: string;
    actionAssignToUserId: string;
    actionAssignmentMode: AutomationActionAssignmentMode;
    eligibleAgentPool: string[];
    actionSetCategoryId: string | null;
    actionSetDepartmentId: string | null;
    actionSetPriority: string | null;
  } | null> {
    const categoryFilter = categoryId
      ? { OR: [{ conditionCategoryId: null }, { conditionCategoryId: categoryId }] }
      : { conditionCategoryId: null };

    const rule = await this.prisma.automationRule.findFirst({
      where: { branchId, isActive: true, ...categoryFilter },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        actionAssignToUserId: true,
        actionAssignmentMode: true,
        eligibleAgentPool: true,
        actionSetCategoryId: true,
        actionSetDepartmentId: true,
        actionSetPriority: true,
      },
    });
    return rule;
  }

  /**
   * RM-24 — `FIXED` (still the default and by far the common case) resolves
   * instantly, with no extra query, to `actionAssignToUserId` — the
   * unchanged, original behavior. `LEAST_LOADED` queries every
   * `eligibleAgentPool` member's own `OPEN`/`IN_PROGRESS` ticket count —
   * the identical `groupBy(by: ["assignedToUserId", "status"], _count:
   * {_all: true})` shape `ReportingService.getAgentPerformance` already
   * uses (Recon confirmed) — and assigns to whichever has fewest, ties
   * broken by `eligibleAgentPool`'s own configured order (the first
   * member seen at the minimum count wins, so an admin who cares about
   * tie-breaking controls it by ordering the pool, not by an arbitrary id
   * comparison). A pool member seeded at `0` (no `groupBy` row at all,
   * meaning zero open tickets) is exactly as eligible as any other — the
   * count map is seeded with every pool member at `0` before the query
   * results are overlaid, so "has never been assigned anything" is never
   * mistaken for "not a real candidate". Falls back to
   * `actionAssignToUserId` when the pool is empty (a rule saved with
   * `LEAST_LOADED` but no pool members yet) — this rule's action always
   * resolves to *some* real user, never nothing.
   */
  private async resolveAssignee(rule: {
    actionAssignToUserId: string;
    actionAssignmentMode: AutomationActionAssignmentMode;
    eligibleAgentPool: string[];
  }): Promise<string> {
    if (rule.actionAssignmentMode !== "LEAST_LOADED" || rule.eligibleAgentPool.length === 0) {
      return rule.actionAssignToUserId;
    }

    const openCountByUserId = new Map<string, number>(rule.eligibleAgentPool.map((userId) => [userId, 0]));
    const grouped = await this.prisma.ticket.groupBy({
      by: ["assignedToUserId", "status"],
      where: {
        assignedToUserId: { in: rule.eligibleAgentPool },
        status: { in: [...OPEN_TICKET_STATUSES] },
      },
      _count: { _all: true },
    });
    for (const row of grouped) {
      const userId = row.assignedToUserId;
      if (!userId) {
        continue;
      }
      openCountByUserId.set(userId, (openCountByUserId.get(userId) ?? 0) + row._count._all);
    }

    let leastLoadedUserId = rule.eligibleAgentPool[0]!;
    let lowestCount = openCountByUserId.get(leastLoadedUserId) ?? 0;
    for (const userId of rule.eligibleAgentPool) {
      const count = openCountByUserId.get(userId) ?? 0;
      if (count < lowestCount) {
        leastLoadedUserId = userId;
        lowestCount = count;
      }
    }
    return leastLoadedUserId;
  }
}
