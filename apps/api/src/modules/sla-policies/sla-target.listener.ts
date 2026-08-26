import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { PrismaService } from "../../prisma/prisma.service";
import { TICKET_CREATED_EVENT } from "../tickets/tickets.events";
import type { TicketCreatedEvent } from "../tickets/tickets.events";

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
 * `TicketHistoryListener`) — reacts to `ticket.created` only (Settled
 * decision 2), never `ticket.updated`. Mirrors `TicketHistoryListener`'s
 * catch-and-log pattern exactly: a computation/persistence failure here must
 * never turn a successful ticket-creation request into a failed one.
 *
 * `TicketCreatedEvent.ticket` (a `TicketSummary`) carries no `branchId` or
 * `createdAt` — this listener re-fetches the fields it needs by
 * `event.ticket.id` rather than relying on the event payload for those, so
 * the existing event contract never needs to change (Settled decision 8).
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

      const departmentFilter = ticket.departmentId
        ? { OR: [{ departmentId: null }, { departmentId: ticket.departmentId }] }
        : { departmentId: null };
      const categoryFilter = ticket.category
        ? { OR: [{ category: null }, { category: ticket.category }] }
        : { category: null };
      const priorityFilter = { OR: [{ priority: null }, { priority: ticket.priority as string }] };

      const candidates = await this.prisma.slaPolicy.findMany({
        where: {
          branchId: ticket.branchId,
          isActive: true,
          AND: [departmentFilter, categoryFilter, priorityFilter],
        },
        orderBy: { createdAt: "asc" },
      });

      const bestPolicy = this.selectMostSpecificPolicy(candidates);
      if (!bestPolicy) {
        return;
      }

      await this.prisma.slaTicketTarget.create({
        data: {
          ticketId: event.ticket.id,
          slaPolicyId: bestPolicy.id,
          responseTargetAt: new Date(
            ticket.createdAt.getTime() + bestPolicy.responseTargetMinutes * MINUTE_MS,
          ),
          resolutionTargetAt: new Date(
            ticket.createdAt.getTime() + bestPolicy.resolutionTargetMinutes * MINUTE_MS,
          ),
        },
      });
    } catch (error) {
      this.logger.error("Failed to compute SLA target for ticket.created", error as Error);
    }
  }

  /**
   * Deterministic policy-resolution rule (Settled decision 5): the
   * candidate with the most non-null scoping dimensions wins ("most
   * specific match wins"). Ties are broken by earliest `createdAt` —
   * `candidates` is pre-sorted `createdAt: "asc"` by the caller, so the
   * first candidate seen at a given score is already the earliest; this
   * loop only replaces `best` on a strictly higher score.
   */
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
