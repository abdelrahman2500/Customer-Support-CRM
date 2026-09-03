import { Injectable } from "@nestjs/common";
import type { AiFeature, TicketStatus } from "@prisma/client";
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
 * — deliberately a per-agent count, not a duration; Story 99's
 * `ResolutionTimeSummary`/`getResolutionTime` below is the branch-wide
 * duration measure (`Ticket.resolvedAt` now exists), not extended here to
 * a per-agent breakdown, since no story has disclosed a need for one. */
export interface AgentPerformanceSummary {
  userId: string;
  fullName: string;
  openCount: number;
  resolvedCount: number;
}

/** `averageResolutionMs` is `null` (never `0`) when `resolvedCount` is `0`
 * — no ticket has ever resolved yet for this branch (in this window),
 * mirroring `CsatSummary`'s own "never a misleading default" convention. */
export interface ResolutionTimeSummary {
  resolvedCount: number;
  averageResolutionMs: number | null;
}

/**
 * Story 121 — one row per `AiFeature` value with at least one `AiPromptLog`
 * row in the caller's branch (in this window) — same "only what exists"
 * convention as `TicketVolumeByStatus`. `totalCostUsd` is `null` (never a
 * misleading `0`) when no successful call in this feature has a priced
 * cost — either because none succeeded, or because every one that did used
 * a model with no entry in `apps/worker`'s price table (see
 * `AiPromptLog.costMicroUsd`'s own schema doc comment); a real `0` would
 * wrongly read as "this feature cost nothing" rather than "cost unknown."
 */
export interface AiUsageByFeature {
  feature: AiFeature;
  callCount: number;
  successCount: number;
  errorCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number | null;
}

/**
 * `unpricedCallCount` is the count of `SUCCESS` calls whose `costMicroUsd`
 * is `null` (an unrecognized/unpriced model) — surfaced explicitly rather
 * than silently folded into `totalCostUsd` as `$0` or silently dropped
 * from `totalCalls`, so a caller can tell "no AI usage yet" apart from
 * "there was usage, but some of it isn't reflected in the cost total."
 */
export interface AiUsageSummary {
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number | null;
  unpricedCallCount: number;
  byFeature: AiUsageByFeature[];
}

/**
 * Story 126 — one row per `TicketCategory` with at least one ticket in the
 * caller's branch (in this window), plus one final `categoryId: null` row
 * for tickets with no category assigned — deliberately not the "only what
 * exists" sparse-and-drop convention `TicketVolumeByStatus` uses for its
 * enum-backed status: `Ticket.categoryId` is a genuinely-optional FK (Story
 * 120), not an always-set enum, so a ticket with none is a real, common,
 * ongoing cohort ("Uncategorized"), not a value that "doesn't exist" the
 * way `getAgentPerformance` treats an unassigned ticket as having no agent
 * to attribute at all. `categoryName` is `null` for that row — the caller
 * (`ReportsView`) renders its own localized "Uncategorized" label, the same
 * "backend returns raw data, frontend supplies any user-facing label" split
 * every other report here already follows (e.g. `AGE_BUCKET_LABELS`).
 */
export interface TicketVolumeByCategory {
  categoryId: string | null;
  categoryName: string | null;
  count: number;
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
 *
 * Story 99 — a sixth method, `getResolutionTime`, over a sixth new column
 * (`Ticket.resolvedAt`, added by this story) — still a direct Prisma read,
 * no schema beyond that one nullable column, no materialized view.
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
   * `resolution`-type `SlaEscalation` was ever recorded for it — deliberately
   * a target-vs-breach measure, not a duration; Story 99's
   * `getResolutionTime` is the actual time-to-resolution measure, kept
   * separate since "met the SLA target" and "how long resolution took" are
   * two different questions with two different cohorts (SLA-targeted
   * tickets vs. every resolved ticket).
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
   * Story 126 — Ticket Volume by Category. Unblocked by Story 120's
   * `Ticket.categoryId` FK (previously free-text `category`, ungroupable).
   * Filters on `Ticket.createdAt`, the same field/table
   * `getTicketVolumeByStatus`/`getTicketAging` already use — "how many
   * tickets, by category, were created in this window." A `groupBy` over
   * the nullable `categoryId` itself (not `categoryId: { not: null }`
   * first, unlike `getAgentPerformance`'s exclusion of unassigned tickets):
   * here, "no category" is exactly the cohort this report exists to
   * surface, not a value with no meaning to attribute counts to.
   *
   * Category names are looked up in a second query, mirroring
   * `getAgentPerformance`'s own `prisma.user.findMany` name-lookup shape —
   * `groupBy` only returns the FK, never the related row. Sorted by
   * `categoryName` ascending, with the `categoryId: null` ("Uncategorized")
   * row always last regardless of its count — a stable, predictable
   * position for the one row with no name to sort by, rather than an
   * arbitrary spot wherever `null` happens to collate.
   */
  async getTicketVolumeByCategory(
    from?: string,
    to?: string,
  ): Promise<TicketVolumeByCategory[]> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const range = resolveReportDateRange(from, to);
    const grouped = await this.prisma.ticket.groupBy({
      by: ["categoryId"],
      where: { branchId, ...(hasDateRange(range) ? { createdAt: range } : {}) },
      _count: { _all: true },
    });

    const categoryIds = grouped
      .map((row) => row.categoryId)
      .filter((categoryId): categoryId is string => categoryId !== null);
    const categories = categoryIds.length
      ? await this.prisma.ticketCategory.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(categories.map((category) => [category.id, category.name]));

    return grouped
      .map((row) => ({
        categoryId: row.categoryId,
        categoryName: row.categoryId === null ? null : (nameById.get(row.categoryId) ?? row.categoryId),
        count: row._count._all,
      }))
      .sort((a, b) => {
        if (a.categoryName === null) return 1;
        if (b.categoryName === null) return -1;
        return a.categoryName.localeCompare(b.categoryName);
      });
  }

  /**
   * Story 60 — the last of Reporting's four named dimensions. Scoped to
   * currently-open tickets only (`OPEN`+`IN_PROGRESS`) — a resolved/closed
   * ticket's age is no longer operationally actionable the way an open
   * one's is. Age is a plain wall-clock difference from `createdAt` to now
   * — no business-hours awareness (unlike SLA target computation) — and
   * deliberately age-since-creation for *currently-open* tickets, never a
   * resolution-duration measure: Story 99's `getResolutionTime` is that
   * measure, scoped to resolved tickets instead. Every bucket always appears, even at
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

  /**
   * Story 99 — closes the gap every other method in this file's own doc
   * comment names ("there is no `Ticket.resolvedAt` column, so a real
   * time-to-resolution measure is ... not possible"). Filters the cohort
   * by `Ticket.resolvedAt` (when the ticket *became* resolved) — the same
   * "filter on whichever timestamp represents when this fact became true"
   * rule `getCsatSummary` already applies to `TicketCsatResponse.createdAt`
   * — not `Ticket.createdAt`: a ticket created months ago but resolved
   * this week belongs in this week's resolution-time report.
   *
   * A plain `findMany` + JS reduction, not a Prisma `aggregate()`: the
   * duration itself (`resolvedAt - createdAt` per row) is a computed value
   * Postgres can't average directly without a raw/computed expression —
   * the same reason `getTicketAging` also reduces in JS rather than
   * aggregating in the query.
   *
   * Historical tickets resolved before this column existed stay
   * `resolvedAt: null` forever (no backfill, by design — see this
   * story's plan) and are excluded here by the same `not: null` guard
   * that excludes every ticket that has simply never resolved.
   */
  async getResolutionTime(from?: string, to?: string): Promise<ResolutionTimeSummary> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const range = resolveReportDateRange(from, to);
    const tickets = await this.prisma.ticket.findMany({
      where: {
        branchId,
        resolvedAt: { not: null, ...(hasDateRange(range) ? range : {}) },
      },
      select: { createdAt: true, resolvedAt: true },
    });

    const resolvedCount = tickets.length;
    if (resolvedCount === 0) {
      return { resolvedCount: 0, averageResolutionMs: null };
    }

    const totalMs = tickets.reduce(
      (sum, ticket) => sum + (ticket.resolvedAt!.getTime() - ticket.createdAt.getTime()),
      0,
    );
    return { resolvedCount, averageResolutionMs: totalMs / resolvedCount };
  }

  /**
   * Story 121 — AI Usage/Cost Reporting. Filters on `AiPromptLog.createdAt`
   * (when the operation was submitted) — the same "filter on whichever
   * timestamp represents when this fact became true" rule every other
   * method here already follows. A single `groupBy(["feature", "outcome"])`
   * (mirrors `getAgentPerformance`'s own two-dimension groupBy-then-merge
   * shape) plus one dedicated `count()` for `unpricedCallCount` — `_sum`
   * only ever accumulates from `SUCCESS` rows in practice (every other
   * outcome's `inputTokens`/`outputTokens`/`costMicroUsd` are always
   * `null`, so they contribute nothing to a Prisma `_sum`), which is also
   * exactly why `totalCostUsd` naturally comes back `null` (not `0`) for a
   * feature/branch with no priced successful call at all — Prisma's own
   * `_sum` returns `null`, not `0`, when it has zero non-null values to
   * add, the same SQL `SUM()` behavior this codebase already relies on
   * nowhere else needing special-casing.
   */
  async getAiUsage(from?: string, to?: string): Promise<AiUsageSummary> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const range = resolveReportDateRange(from, to);
    const dateFilter = hasDateRange(range) ? { createdAt: range } : {};

    const grouped = await this.prisma.aiPromptLog.groupBy({
      by: ["feature", "outcome"],
      where: { branchId, ...dateFilter },
      _count: { _all: true },
      _sum: { inputTokens: true, outputTokens: true, costMicroUsd: true },
    });

    const unpricedCallCount = await this.prisma.aiPromptLog.count({
      where: { branchId, outcome: "SUCCESS", costMicroUsd: null, ...dateFilter },
    });

    const byFeatureMap = new Map<AiFeature, AiUsageByFeature>();
    for (const row of grouped) {
      const existing = byFeatureMap.get(row.feature) ?? {
        feature: row.feature,
        callCount: 0,
        successCount: 0,
        errorCount: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCostUsd: null,
      };
      existing.callCount += row._count._all;
      if (row.outcome === "SUCCESS") {
        existing.successCount += row._count._all;
      } else if (row.outcome === "ERROR") {
        existing.errorCount += row._count._all;
      }
      existing.totalInputTokens += row._sum.inputTokens ?? 0;
      existing.totalOutputTokens += row._sum.outputTokens ?? 0;
      if (row._sum.costMicroUsd !== null) {
        existing.totalCostUsd = (existing.totalCostUsd ?? 0) + row._sum.costMicroUsd / 1_000_000;
      }
      byFeatureMap.set(row.feature, existing);
    }

    const byFeature = [...byFeatureMap.values()].sort((a, b) => a.feature.localeCompare(b.feature));
    const totalCostUsd = byFeature.some((row) => row.totalCostUsd !== null)
      ? byFeature.reduce((sum, row) => sum + (row.totalCostUsd ?? 0), 0)
      : null;

    return {
      totalCalls: byFeature.reduce((sum, row) => sum + row.callCount, 0),
      totalInputTokens: byFeature.reduce((sum, row) => sum + row.totalInputTokens, 0),
      totalOutputTokens: byFeature.reduce((sum, row) => sum + row.totalOutputTokens, 0),
      totalCostUsd,
      unpricedCallCount,
      byFeature,
    };
  }
}
