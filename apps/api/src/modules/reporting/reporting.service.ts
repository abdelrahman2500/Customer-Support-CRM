import { Injectable } from "@nestjs/common";
import type { TicketStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "../../common/tenant/tenant-context";

/** One row per `TicketStatus` value with at least one ticket in the caller's
 * branch — no zero-padding, same "only what exists" convention as every
 * other list endpoint in this codebase. */
export interface TicketVolumeByStatus {
  status: TicketStatus;
  count: number;
}

/**
 * `complianceRate` is `null` (never a misleading `0`/`100`) when
 * `totalWithTarget` is `0` — no SLA-targeted ticket exists yet for this
 * branch.
 */
export interface SlaComplianceSummary {
  totalWithTarget: number;
  breachedCount: number;
  compliantCount: number;
  complianceRate: number | null;
}

/** `averageRating` is `null` (never `0`) when `responseCount` is `0` — no
 * feedback has been submitted yet for this branch. */
export interface CsatSummary {
  responseCount: number;
  averageRating: number | null;
}

/**
 * Story 56 — Reporting & Analytics Foundation. Every query is a direct
 * Prisma read over already-modeled data (`Ticket`/`SlaTicketTarget`/
 * `SlaEscalation`/`TicketCsatResponse`) — no new schema, no materialized
 * view, no worker job (docs/architecture/08-supporting-domains.md: "starts
 * with direct queries... materialized views... deferred until query load
 * ... outgrow Postgres"). Every method is branch-scoped via
 * `TenantContext.requireBranchScope()`, the same mechanism every other
 * branch-scoped read in this codebase already uses.
 */
@Injectable()
export class ReportingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async getTicketVolumeByStatus(): Promise<TicketVolumeByStatus[]> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const grouped = await this.prisma.ticket.groupBy({
      by: ["status"],
      where: { branchId },
      _count: { _all: true },
    });
    return grouped.map((row) => ({ status: row.status, count: row._count._all }));
  }

  /**
   * "Compliant" means an `SlaTicketTarget` existed for the ticket and no
   * `resolution`-type `SlaEscalation` was ever recorded for it — there is no
   * `Ticket.resolvedAt` column in this schema (confirmed during Recon), so a
   * real time-to-resolution measure is not yet possible and is explicitly
   * deferred, not approximated here.
   *
   * `distinct: ["ticketId"]` on the escalation lookup, not a raw row count:
   * `SlaEscalation` is unique on `(ticketId, targetType, targetAt)`, so a
   * ticket recategorized after already breaching could in principle carry
   * more than one `resolution`-type row across different target windows —
   * counting distinct tickets avoids double-counting a single ticket twice.
   */
  async getSlaCompliance(): Promise<SlaComplianceSummary> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const totalWithTarget = await this.prisma.slaTicketTarget.count({
      where: { ticket: { branchId } },
    });
    const breachedTickets = await this.prisma.slaEscalation.findMany({
      where: { branchId, targetType: "resolution" },
      select: { ticketId: true },
      distinct: ["ticketId"],
    });
    const breachedCount = breachedTickets.length;
    const compliantCount = Math.max(totalWithTarget - breachedCount, 0);
    const complianceRate = totalWithTarget > 0 ? compliantCount / totalWithTarget : null;
    return { totalWithTarget, breachedCount, compliantCount, complianceRate };
  }

  /** Scoped through the `Ticket` relation, not a denormalized `branchId`
   * column — `TicketCsatResponse` carries none of its own, by design, same
   * as `TicketNote` (mirrors `SlaEscalationsService`'s own
   * scope-through-the-parent-Ticket pattern where a child has no branch
   * column of its own). */
  async getCsatSummary(): Promise<CsatSummary> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const result = await this.prisma.ticketCsatResponse.aggregate({
      where: { ticket: { branchId } },
      _avg: { rating: true },
      _count: { _all: true },
    });
    return {
      responseCount: result._count._all,
      averageRating: result._avg.rating,
    };
  }
}
