import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "../../common/tenant/tenant-context";

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
   */
  async listAuditLogs(): Promise<AuditLogSummary[]> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const logs = await this.prisma.auditLog.findMany({
      where: { OR: [{ branchId }, { branchId: null }] },
      orderBy: { createdAt: "desc" },
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
