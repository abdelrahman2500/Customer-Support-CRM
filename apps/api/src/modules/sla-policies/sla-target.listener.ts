import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { PrismaService } from "../../prisma/prisma.service";
import { TICKET_CREATED_EVENT, TICKET_RECATEGORIZED_EVENT } from "../tickets/tickets.events";
import type { TicketCreatedEvent, TicketRecategorizedEvent } from "../tickets/tickets.events";
import { addBusinessMinutes } from "./business-hours-calculator";

const MINUTE_MS = 60_000;

interface PolicyCandidate {
  id: string;
  departmentId: string | null;
  category: string | null;
  priority: string | null;
  responseTargetMinutes: number;
  resolutionTargetMinutes: number;
}

/**
 * The second real subscriber to `TicketsService`'s events (after
 * `TicketHistoryListener`) — reacts to `ticket.created` (Settled decision 2)
 * and, as of Story 16, `ticket.recategorized`. Never `ticket.updated`
 * directly. Mirrors `TicketHistoryListener`'s catch-and-log pattern exactly:
 * a computation/persistence failure here must never turn a successful
 * ticket-creation/update request into a failed one.
 *
 * `TicketCreatedEvent.ticket`/`TicketRecategorizedEvent.ticket` (a
 * `TicketSummary`) carries no `branchId` or `createdAt` — this listener
 * re-fetches the fields it needs by `event.ticket.id` rather than relying on
 * the event payload for those, so the existing event contracts never need to
 * change (Settled decision 8; Story 16 Design item 3).
 */
@Injectable()
export class SlaTargetListener {
  private readonly logger = new Logger(SlaTargetListener.name);

  constructor(private readonly prisma: PrismaService) {}

  @OnEvent(TICKET_CREATED_EVENT)
  async onTicketCreated(event: TicketCreatedEvent): Promise<void> {
    try {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: event.ticket.id },
        select: {
          branchId: true,
          departmentId: true,
          category: true,
          priority: true,
          createdAt: true,
        },
      });
      if (!ticket) {
        return;
      }

      const bestPolicy = await this.resolveBestPolicy(ticket);
      if (!bestPolicy) {
        return;
      }

      const [responseTargetAt, resolutionTargetAt] = await this.computeTargetTimestamps(ticket, bestPolicy);

      await this.prisma.slaTicketTarget.create({
        data: {
          ticketId: event.ticket.id,
          slaPolicyId: bestPolicy.id,
          responseTargetAt,
          resolutionTargetAt,
        },
      });
    } catch (error) {
      this.logger.error("Failed to compute SLA target for ticket.created", error as Error);
    }
  }

  /**
   * The third real subscriber — reacts to `ticket.recategorized` only
   * (Story 16 Design item 1), never `ticket.updated` directly. Reuses
   * `resolveBestPolicy`/`computeTargetTimestamps` verbatim — the same
   * policy-resolution and business-hours computation `onTicketCreated` uses;
   * no second, parallel implementation of either.
   *
   * The ticket's single `SlaTicketTarget` row (`ticketId` is `@unique`) is
   * updated in place via `upsert`, never duplicated. When no policy matches
   * the new classification, the existing target is deleted instead — a
   * stale target would otherwise misrepresent this ticket's SLA state
   * (Story 16 Design item 4). Every write that changes `slaPolicyId`/target
   * timestamps also unconditionally resets all four Story 15 fire-once
   * notification columns to `null` (Story 16 Design items 6-7) — the one
   * deliberate exception to "never mutated" those columns already carry,
   * extended here to also apply on recomputation, not only on first
   * detection.
   */
  @OnEvent(TICKET_RECATEGORIZED_EVENT)
  async onTicketRecategorized(event: TicketRecategorizedEvent): Promise<void> {
    try {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: event.ticket.id },
        select: {
          branchId: true,
          departmentId: true,
          category: true,
          priority: true,
          createdAt: true,
        },
      });
      if (!ticket) {
        return;
      }

      const bestPolicy = await this.resolveBestPolicy(ticket);
      if (!bestPolicy) {
        // No policy matches the new classification — an existing target
        // would now misrepresent this ticket's SLA state (Design item 4).
        await this.prisma.slaTicketTarget.deleteMany({ where: { ticketId: event.ticket.id } });
        return;
      }

      const [responseTargetAt, resolutionTargetAt] = await this.computeTargetTimestamps(ticket, bestPolicy);

      // Fire-once notification state is reset unconditionally on every
      // recomputed write (Design item 6) — never conditionally preserved.
      await this.prisma.slaTicketTarget.upsert({
        where: { ticketId: event.ticket.id },
        create: {
          ticketId: event.ticket.id,
          slaPolicyId: bestPolicy.id,
          responseTargetAt,
          resolutionTargetAt,
        },
        update: {
          slaPolicyId: bestPolicy.id,
          responseTargetAt,
          resolutionTargetAt,
          responseAtRiskNotifiedAt: null,
          responseBreachedNotifiedAt: null,
          resolutionAtRiskNotifiedAt: null,
          resolutionBreachedNotifiedAt: null,
        },
      });
    } catch (error) {
      this.logger.error("Failed to recompute SLA target for ticket.recategorized", error as Error);
    }
  }

  /**
   * Deterministic policy-resolution rule (Settled decision 5): the
   * candidate with the most non-null scoping dimensions wins ("most
   * specific match wins"). Ties are broken by earliest `createdAt` — the
   * `slaPolicy.findMany` query is sorted `createdAt: "asc"`, so the first
   * candidate seen at a given score is already the earliest; this loop only
   * replaces `best` on a strictly higher score. Shared verbatim by
   * `onTicketCreated` and `onTicketRecategorized` (Story 16) — not
   * reimplemented per caller.
   */
  private async resolveBestPolicy(ticket: {
    branchId: string;
    departmentId: string | null;
    category: string | null;
    priority: string;
  }): Promise<PolicyCandidate | null> {
    const departmentFilter = ticket.departmentId
      ? { OR: [{ departmentId: null }, { departmentId: ticket.departmentId }] }
      : { departmentId: null };
    const categoryFilter = ticket.category
      ? { OR: [{ category: null }, { category: ticket.category }] }
      : { category: null };
    const priorityFilter = { OR: [{ priority: null }, { priority: ticket.priority }] };

    const candidates = await this.prisma.slaPolicy.findMany({
      where: {
        branchId: ticket.branchId,
        isActive: true,
        AND: [departmentFilter, categoryFilter, priorityFilter],
      },
      orderBy: { createdAt: "asc" },
    });

    return this.selectMostSpecificPolicy(candidates);
  }

  /**
   * Business-hours-aware target computation (Story 13), falling back to
   * plain wall-clock arithmetic (Story 11) when the branch has no
   * `BusinessHoursCalendar`. Always anchored to `ticket.createdAt` — even on
   * recomputation, this does not "restart the SLA clock" (Story 16 Design
   * item 5). Shared verbatim by `onTicketCreated` and
   * `onTicketRecategorized`.
   */
  private async computeTargetTimestamps(
    ticket: { branchId: string; createdAt: Date },
    policy: PolicyCandidate,
  ): Promise<[Date, Date]> {
    const calendar = await this.prisma.businessHoursCalendar.findFirst({
      where: { branchId: ticket.branchId },
      include: { branch: { select: { timezone: true } }, days: true, exceptions: true },
    });

    return calendar
      ? [
          addBusinessMinutes(
            ticket.createdAt,
            policy.responseTargetMinutes,
            calendar.branch.timezone,
            calendar.days,
            calendar.exceptions,
          ),
          addBusinessMinutes(
            ticket.createdAt,
            policy.resolutionTargetMinutes,
            calendar.branch.timezone,
            calendar.days,
            calendar.exceptions,
          ),
        ]
      : [
          new Date(ticket.createdAt.getTime() + policy.responseTargetMinutes * MINUTE_MS),
          new Date(ticket.createdAt.getTime() + policy.resolutionTargetMinutes * MINUTE_MS),
        ];
  }

  private selectMostSpecificPolicy(candidates: PolicyCandidate[]): PolicyCandidate | null {
    let best: PolicyCandidate | null = null;
    let bestScore = -1;
    for (const candidate of candidates) {
      const score =
        (candidate.departmentId !== null ? 1 : 0) +
        (candidate.category !== null ? 1 : 0) +
        (candidate.priority !== null ? 1 : 0);
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    return best;
  }
}
