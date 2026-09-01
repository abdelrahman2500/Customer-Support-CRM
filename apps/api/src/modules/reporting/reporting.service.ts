import { Injectable } from "@nestjs/common";
import type { TicketStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "../../common/tenant/tenant-context";
import { hasDateRange, resolveReportDateRange } from "./report-date-range.util";

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

/** One row per agent with at least one ticket currently assigned to them in
 * the caller's branch (an agent with none does not appear — same
 * "only what exists" convention as `TicketVolumeByStatus`).
 * `openCount` is `OPEN`+`IN_PROGRESS`; `resolvedCount` is `RESOLVED`+`CLOSED`
 * — there is no `Ticket.resolvedAt` column, so a real time-to-resolution
 * measure is still not possible (same gap `SlaComplianceSummary` already
 * documents) and this is a count, not a duration. */
export interface AgentPerformanceSummary {
  userId: string;
  fullName: string;
  openCount: number;
  resolvedCount: number;
}

/** Fixed age buckets for currently-open tickets, always returned in this
 * order regardless of counts (Design decision 1 of the plan — a small,
 * always-complete distribution reads more naturally than a sparse list). */
export const AGE_BUCKET_LABELS = ["0-1d", "1-3d", "3-7d", "7d+"] as const;
export type AgeBucketLabel = (typeof AGE_BUCKET_LABELS)[number];

export interface TicketAgingBucket {
  bucket: AgeBucketLabel;
  count: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function bucketForAgeDays(ageDays: number): AgeBucketLabel {
  if (ageDays < 1) return "0-1d";
  if (ageDays < 3) return "1-3d";
  if (ageDays < 7) return "3-7d";
  return "7d+";
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
 *
 * Story 93 — every method gains optional `from`/`to` (`YYYY-MM-DD`,
 * resolved via `resolveReportDateRange`). Each report filters on whichever
 * timestamp actually represents "when this fact became true" for that
 * report — not a single blanket `Ticket.createdAt` — see each method's own
 * doc comment. Omitting both produces a `where` textually identical to the
 * pre-Story-93 query (guarded by `hasDateRange`), so every existing
 * no-range caller/test is unaffected.
 */
@Injectable()
export class ReportingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  /** Filters on `Ticket.createdAt` — "how many tickets, by status, were
   * created in this window." The same field/table `getTicketAging` already
   * uses. */
  async getTicketVolumeByStatus(from?: string, to?: string): Promise<TicketVolumeByStatus[]> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const range = resolveReportDateRange(from, to);
    const grouped = await this.prisma.ticket.groupBy({
      by: ["status"],
      where: { branchId, ...(hasDateRange(range) ? { createdAt: range } : {}) },
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
   * Story 93 — the reporting cohort is defined by `SlaTicketTarget.createdAt`
   * (when the ticket entered SLA tracking), not `SlaEscalation.escalatedAt`
   * (when a breach was recorded): the two can differ (a ticket targeted
   * last month can breach this month), and mixing them would let
   * `breachedCount` describe a different set of tickets than
   * `totalWithTarget`, breaking the `compliantCount = totalWithTarget -
   * breachedCount` arithmetic's own meaning. Selecting `ticketId` (not
   * `count()`) is what makes the escalation lookup below
   * cohort-constrained: `SlaTicketTarget.ticketId` is `@unique` (one row
   * per ticket, ever — Story 16's recategorization updates it in place
   * rather than creating a new row), so `ticketIds` is exactly the set of
   * tickets in this report's cohort, and `breachedCount` can never exceed
   * `totalWithTarget` by construction, not merely by the defensive
   * `Math.max` below (kept as cheap, harmless defense-in-depth).
   *
   * `distinct: ["ticketId"]` on the escalation lookup, not a raw row count:
   * `SlaEscalation` is unique on `(ticketId, targetType, targetAt)`, so a
   * ticket recategorized after already breaching could in principle carry
   * more than one `resolution`-type row across different target windows —
   * counting distinct tickets avoids double-counting a single ticket twice.
   */
  async getSlaCompliance(from?: string, to?: string): Promise<SlaComplianceSummary> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const range = resolveReportDateRange(from, to);

    const targets = await this.prisma.slaTicketTarget.findMany({
      where: { ticket: { branchId }, ...(hasDateRange(range) ? { createdAt: range } : {}) },
      select: { ticketId: true },
    });
    const totalWithTarget = targets.length;
    const ticketIds = targets.map((target) => target.ticketId);

    const breachedTickets = ticketIds.length
      ? await this.prisma.slaEscalation.findMany({
          where: { branchId, targetType: "resolution", ticketId: { in: ticketIds } },
          select: { ticketId: true },
          distinct: ["ticketId"],
        })
      : [];
    const breachedCount = breachedTickets.length;
    const compliantCount = Math.max(totalWithTarget - breachedCount, 0);
    const complianceRate = totalWithTarget > 0 ? compliantCount / totalWithTarget : null;
    return { totalWithTarget, breachedCount, compliantCount, complianceRate };
  }

  /** Scoped through the `Ticket` relation, not a denormalized `branchId`
   * column — `TicketCsatResponse` carries none of its own, by design, same
   * as `TicketNote` (mirrors `SlaEscalationsService`'s own
   * scope-through-the-parent-Ticket pattern where a child has no branch
   * column of its own).
   *
   * Story 93 — filters on `TicketCsatResponse.createdAt` (submission time),
   * not `Ticket.createdAt`: this report means "feedback submitted in this
   * window," not "feedback on tickets created in this window" — the only
   * sensible anchor for a CSAT trend report. */
  async getCsatSummary(from?: string, to?: string): Promise<CsatSummary> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const range = resolveReportDateRange(from, to);
    const result = await this.prisma.ticketCsatResponse.aggregate({
      where: { ticket: { branchId }, ...(hasDateRange(range) ? { createdAt: range } : {}) },
      _avg: { rating: true },
      _count: { _all: true },
    });
    return {
      responseCount: result._count._all,
      averageRating: result._avg.rating,
    };
  }

  /**
   * Story 59 — one more direct query over already-modeled data, no schema
   * change. Unassigned tickets (`assignedToUserId: null`) are excluded
   * entirely — there is no "agent" to attribute them to. Sorted by
   * `fullName` ascending — simple, deterministic, no workload-ranking
   * judgment call baked into the API response itself.
   *
   * Story 93 — filters on `Ticket.createdAt` (same field/table as ticket
   * volume). Flagged semantic shift, not silently redefined: with no range,
   * this is a *live workload snapshot* ("tickets currently assigned to me,
   * by current status"); with a range applied it becomes *"of tickets
   * created in this window, their current status breakdown"* — a
   * cohort-outcome view, not a live-workload view. Same category of
   * disclosed limitation this method's own "no `resolvedAt`, count only"
   * comment already carries.
   */
  async getAgentPerformance(from?: string, to?: string): Promise<AgentPerformanceSummary[]> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const range = resolveReportDateRange(from, to);
    const grouped = await this.prisma.ticket.groupBy({
      by: ["assignedToUserId", "status"],
      where: {
        branchId,
        assignedToUserId: { not: null },
        ...(hasDateRange(range) ? { createdAt: range } : {}),
      },
      _count: { _all: true },
    });

    const countsByUserId = new Map<string, { openCount: number; resolvedCount: number }>();
    for (const row of grouped) {
      const userId = row.assignedToUserId as string;
      const counts = countsByUserId.get(userId) ?? { openCount: 0, resolvedCount: 0 };
      if (row.status === "OPEN" || row.status === "IN_PROGRESS") {
        counts.openCount += row._count._all;
      } else {
        counts.resolvedCount += row._count._all;
      }
      countsByUserId.set(userId, counts);
    }

    if (countsByUserId.size === 0) {
      return [];
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: [...countsByUserId.keys()] } },
      select: { id: true, fullName: true },
    });
    const fullNameById = new Map(users.map((user) => [user.id, user.fullName]));

    return [...countsByUserId.entries()]
      .map(([userId, counts]) => ({
        userId,
        fullName: fullNameById.get(userId) ?? userId,
        ...counts,
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  /**
   * Story 60 — the last of Reporting's four named dimensions. Scoped to
   * currently-open tickets only (`OPEN`+`IN_PROGRESS`) — a resolved/closed
   * ticket's age is no longer operationally actionable the way an open
   * one's is. Age is a plain wall-clock difference from `createdAt` to now
   * — no business-hours awareness (unlike SLA target computation), and no
   * `Ticket.resolvedAt` column exists, so this is age-since-creation, never
   * a resolution-duration measure. Every bucket always appears, even at
   * `0` (Design decision 1) — unlike `TicketVolumeByStatus`'s sparse
   * "only what exists" convention.
   *
   * Story 93 — the range filters *which currently-open tickets are
   * included* (`Ticket.createdAt` within the window); the age bucketing
   * itself stays relative to the real current time, unchanged. This report
   * is inherently a live snapshot ("how old are today's currently-open
   * tickets") — reinterpreting age as "as of `to`" would invent a new
   * "as-of" semantic with no precedent anywhere else in this codebase. With
   * a range applied, this reads as "of tickets created in this window that
   * are *still* open today, how old are they now."
   */
  async getTicketAging(from?: string, to?: string): Promise<TicketAgingBucket[]> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const range = resolveReportDateRange(from, to);
    const tickets = await this.prisma.ticket.findMany({
      where: {
        branchId,
        status: { in: ["OPEN", "IN_PROGRESS"] },
        ...(hasDateRange(range) ? { createdAt: range } : {}),
      },
      select: { createdAt: true },
    });

    const countsByBucket = new Map<AgeBucketLabel, number>(
      AGE_BUCKET_LABELS.map((label) => [label, 0]),
    );
    const now = Date.now();
    for (const ticket of tickets) {
      const ageDays = (now - ticket.createdAt.getTime()) / MS_PER_DAY;
      const bucket = bucketForAgeDays(ageDays);
      countsByBucket.set(bucket, (countsByBucket.get(bucket) ?? 0) + 1);
    }

    return AGE_BUCKET_LABELS.map((bucket) => ({ bucket, count: countsByBucket.get(bucket) ?? 0 }));
  }
}
