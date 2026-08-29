import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "../../common/tenant/tenant-context";

export interface SlaEscalationSummary {
  id: string;
  ticketId: string;
  branchId: string;
  targetType: string;
  targetAt: Date;
  escalatedAt: Date;
}

/**
 * Read-only access to a ticket's SLA escalation history. Owns the `sla`
 * schema the same way `SlaTargetsService` does, scoping through the parent
 * `Ticket` (mirroring `SlaTargetsService.getSlaTargetForTicket`'s shape)
 * even though `SlaEscalation.branchId` also exists directly on the row —
 * consistency with the sibling endpoint's scoping mechanism is preferred.
 * Unlike `SlaTargetsService` (which 404s when a ticket has no target, since
 * every ticket always has exactly one), an empty escalation list is the
 * normal case (most tickets are never breached), so this returns `[]`
 * rather than throwing.
 */
@Injectable()
export class SlaEscalationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async getEscalationsForTicket(ticketId: string): Promise<SlaEscalationSummary[]> {
    const { branchId } = this.tenantContext.requireBranchScope();

    const ticket = await this.prisma.ticket.findFirst({ where: { id: ticketId, branchId } });
    if (!ticket) {
      throw new NotFoundException("Ticket not found");
    }

    const escalations = await this.prisma.slaEscalation.findMany({
      where: { ticketId },
      orderBy: { escalatedAt: "desc" },
    });

    return escalations.map((escalation) => ({
      id: escalation.id,
      ticketId: escalation.ticketId,
      branchId: escalation.branchId,
      targetType: escalation.targetType,
      targetAt: escalation.targetAt,
      escalatedAt: escalation.escalatedAt,
    }));
  }
}
