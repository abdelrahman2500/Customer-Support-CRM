import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "../../common/tenant/tenant-context";

export interface SlaTargetSummary {
  id: string;
  ticketId: string;
  slaPolicyId: string;
  responseTargetAt: Date;
  resolutionTargetAt: Date;
}

/**
 * Read-only access to a ticket's computed SLA target. Owns the `sla` schema
 * the same way `SlaPoliciesService` does, but scopes through the parent
 * `Ticket` (mirroring `TicketsService.getTicketHistory`'s scope-through-
 * parent shape) since `SlaTicketTarget` carries no `branchId` of its own.
 */
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
    };
  }
}
