import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  AUTOMATION_RULE_MATCHED_EVENT,
} from "../sla-policies/automation.events";
import type { AutomationRuleMatchedEvent } from "../sla-policies/automation.events";
import { TICKET_UPDATED_EVENT, TICKET_RECATEGORIZED_EVENT } from "./tickets.events";
import type { TicketUpdatedEvent, TicketRecategorizedEvent } from "./tickets.events";
import { toTicketSummary } from "./tickets.service";

/**
 * Story 57 — reacts to the SLA & Automation domain's
 * `automation.rule_matched`, never reads or writes anything outside this
 * module's own `Ticket` table — mirrors `TicketEscalationListener`'s exact
 * "the domain that owns the mutated data performs the mutation" pattern
 * (docs/architecture/03-domain-boundaries.md Rule 1). Re-fetches the ticket
 * by `event.ticketId` rather than trusting any stale state the emitting
 * listener saw. Catch-and-log throughout.
 *
 * Story 83 — `actionSetCategory`/`actionSetDepartmentId` added alongside
 * the original `assignedToUserId` action. Each of the three fields is
 * applied independently, only when the ticket's own current value is
 * still `null` — never overriding an explicit human choice, the same
 * guard `assignedToUserId` already had, now generalized per-field rather
 * than as one unified early return (a ticket already assigned, e.g. by a
 * human who claimed it first, can still legitimately receive an
 * automation-driven category/department). When the applied change
 * includes `category`/`departmentId`, this also emits
 * `TICKET_RECATEGORIZED_EVENT` — the exact same reconciliation signal
 * `TicketsService.updateTicket` emits for a human `PATCH`
 * (`tickets.service.ts`'s own `isRecategorized` shape) — so
 * `SlaTargetListener` recomputes the SLA target with zero new SLA-domain
 * code.
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
      if (!ticket) {
        return;
      }

      const data: Prisma.TicketUpdateInput = {};
      if (!ticket.assignedToUserId) {
        data.assignedToUser = { connect: { id: event.assignToUserId } };
      }
      if (event.setCategory && !ticket.category) {
        data.category = event.setCategory;
      }
      if (event.setDepartmentId && !ticket.departmentId) {
        data.department = { connect: { id: event.setDepartmentId } };
      }
      if (Object.keys(data).length === 0) {
        // Every eligible field was already set by the time this event was
        // processed (e.g. an agent claimed/categorized it in the meantime,
        // or a second matched event for the same ticket) — never overwrite.
        return;
      }

      const wasRecategorized = data.category !== undefined || data.department !== undefined;

      const updated = await this.prisma.ticket.update({ where: { id: event.ticketId }, data });
      const summary = toTicketSummary(updated);

      this.eventEmitter.emit(TICKET_UPDATED_EVENT, {
        ticket: summary,
        actorUserId: null,
      } satisfies TicketUpdatedEvent);
      if (wasRecategorized) {
        this.eventEmitter.emit(TICKET_RECATEGORIZED_EVENT, {
          ticket: summary,
          actorUserId: null,
        } satisfies TicketRecategorizedEvent);
      }
    } catch (error) {
      this.logger.error(
        "Failed to apply automation rule actions for automation.rule_matched",
        error as Error,
      );
    }
  }
}
