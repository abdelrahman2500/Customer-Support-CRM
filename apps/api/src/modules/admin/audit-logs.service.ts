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
   * (which only ever writes it). Scoped directly by `AuditLog.branchId`
   * (unlike `NotificationsService`'s ticket-relation workaround): every
   * *authenticated* mutating request's row already carries the real acting
   * branch (`AuditInterceptor` sets it from `user?.branchId`); a `null`
   * branchId here only ever means the action happened before/without
   * tenant context (e.g. a `login` attempt), which is correctly not part
   * of any specific branch's audit trail — there is no relation to fall
   * back through the way `NotificationLog.ticketId` provided for
   * escalation rows.
   */
  async listAuditLogs(): Promise<AuditLogSummary[]> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const logs = await this.prisma.auditLog.findMany({
      where: { branchId },
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
