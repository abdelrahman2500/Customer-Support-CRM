import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "../../common/tenant/tenant-context";

export interface SlaTargetSummary {
  id: string;
  ticketId: string;
  slaPolicyId: string;
  responseTargetAt: Date;
  resolutionTargetAt: Date;
  /** RM-25 — `null` means not on hold. See `SlaHoldListener`'s own doc
   * comment for the full pause/resume mechanics. */
  onHoldSince: Date | null;
  /** Demo hardening — when an agent first replied (the first outbound
   * message sent by a user), or `null`. A reply satisfies the response
   * target; the UI then governs by the resolution target. */
  firstResponseAt: Date | null;
}

/**
 * Read-only access to a ticket's computed SLA target. Owns the `sla` schema
 * the same way `SlaPoliciesService` does, but scopes through the parent
 * `Ticket` (mirroring `TicketsService.getTicketHistory`'s scope-through-
 * parent shape) since `SlaTicketTarget` carries no `branchId` of its own.
 */
/** The first outbound message a person (not the AI) sent on a ticket. */
async function firstAgentReplyAt(prisma: PrismaService, ticketId: string): Promise<Date | null> {
  const reply = await prisma.channelMessage.findFirst({
    where: { ticketId, direction: "OUTBOUND", senderUserId: { not: null } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  return reply?.createdAt ?? null;
}

@Injectable()
export class SlaTargetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async getSlaTargetForTicket(ticketId: string): Promise<SlaTargetSummary> {
    const { branchId } = this.tenantContext.requireBranchScope();

    const ticket = await this.prisma.ticket.findFirst({ where: { id: ticketId, branchId } });
    if (!ticket) {
      throw new NotFoundException("Ticket not found");
    }

    const target = await this.prisma.slaTicketTarget.findUnique({ where: { ticketId } });
    if (!target) {
      throw new NotFoundException("SLA target not found for this ticket");
    }

    return {
      id: target.id,
      ticketId: target.ticketId,
      slaPolicyId: target.slaPolicyId,
      responseTargetAt: target.responseTargetAt,
      resolutionTargetAt: target.resolutionTargetAt,
      onHoldSince: target.onHoldSince,
      firstResponseAt: (await firstAgentReplyAt(this.prisma, ticketId)) ?? null,
    };
  }
}
