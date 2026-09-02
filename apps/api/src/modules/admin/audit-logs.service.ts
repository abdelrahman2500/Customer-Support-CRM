import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "../../common/tenant/tenant-context";
import { resolveReportDateRange, hasDateRange } from "../reporting/report-date-range.util";
import type { ListAuditLogsQueryDto } from "./dto/list-audit-logs-query.dto";

/** Story 104 — an unfiltered, unbounded read of an ever-appending,
 * globally-written table (`AuditInterceptor` writes a row for every
 * mutating request across the whole application) is a latent query-cost
 * risk with no natural ceiling. 200 is a generous page for a human
 * reading the trail — full pagination is deliberately out of scope (see
 * this story's own plan doc's Non-Goals); narrowing by filter, not
 * paging deeper, is this story's answer to "I need to see more." */
const MAX_AUDIT_LOG_ROWS = 200;

/** Mirrors the real `AuditLog` Prisma model exactly — every column is
 * already meaningful to a reader of the audit trail (unlike
 * `NotificationLog`'s internal `dedupeKey`), so nothing is trimmed. */
export interface AuditLogSummary {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  branchId: string | null;
  diff: unknown;
  ipAddress: string | null;
  createdAt: Date;
}

@Injectable()
export class AuditLogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  /**
   * Story 37 — first real consumer of `AuditLog` beyond `AuditInterceptor`
   * (which only ever writes it). Scoped by `AuditLog.branchId` (unlike
   * `NotificationsService`'s ticket-relation workaround): every
   * *authenticated* mutating request's row already carries the real acting
   * branch (`AuditInterceptor` sets it from `user?.branchId`).
   *
   * Story 84 widened this from a plain `{ branchId }` equality filter to
   * also include `branchId: null` rows. A `null` branchId means the event
   * happened before/without tenant context — a failed login for an
   * unknown/inactive user, or a wrong password, where no branch can be
   * attributed at all. `IdentityService` now writes exactly these rows
   * (`auth.login_failed`) explicitly, and they need to remain visible to
   * *someone* reading the audit trail; excluding them under a strict
   * equality match would make that data permanently unreadable through
   * this endpoint. There is still no relation to fall back through the
   * way `NotificationLog.ticketId` provided for escalation rows, so a
   * branch-scoped caller sees every branch-less row in addition to their
   * own branch's — an acceptable trade-off since these rows are rare
   * (failed-auth events only) and carry no other tenant's branch-scoped
   * data.
   *
   * Story 104 — `action`/`entityType`/`actorId` are additional, optional
   * exact-match `AND` conditions alongside the existing branch/null `OR`
   * scope (never replacing it); `from`/`to` reuse
   * `resolveReportDateRange` verbatim, filtering on `createdAt` — the
   * timestamp that *is* this row's own fact, unlike the reporting
   * module's own "which timestamp represents when this fact became true"
   * distinction (there is only one timestamp here). `take:
   * MAX_AUDIT_LOG_ROWS` is unconditional — every caller, filtered or not,
   * is capped.
   */
  async listAuditLogs(query: ListAuditLogsQueryDto = {}): Promise<AuditLogSummary[]> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const range = resolveReportDateRange(query.from, query.to);
    const branchScope: Prisma.AuditLogWhereInput = { OR: [{ branchId }, { branchId: null }] };
    const extraConditions: Prisma.AuditLogWhereInput[] = [];
    if (query.action !== undefined) {
      extraConditions.push({ action: query.action });
    }
    if (query.entityType !== undefined) {
      extraConditions.push({ entityType: query.entityType });
    }
    if (query.actorId !== undefined) {
      extraConditions.push({ actorId: query.actorId });
    }
    if (hasDateRange(range)) {
      extraConditions.push({ createdAt: range });
    }
    // Only wrap in `AND` once a second fragment actually exists — mirrors
    // `TicketsService.resolveSearchAndVisibilityFilter`'s own precedent:
    // an all-omitted-filters call produces a `where` textually identical
    // to the pre-Story-104 query.
    const where: Prisma.AuditLogWhereInput =
      extraConditions.length > 0 ? { AND: [branchScope, ...extraConditions] } : branchScope;

    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: MAX_AUDIT_LOG_ROWS,
    });
    return logs.map((log) => ({
      id: log.id,
      actorId: log.actorId,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      branchId: log.branchId,
      diff: log.diff,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt,
    }));
  }
}
