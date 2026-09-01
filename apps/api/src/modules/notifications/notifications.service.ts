import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "../../common/tenant/tenant-context";

/**
 * Story 36 — mirrors the real `NotificationLog` Prisma model, minus
 * `dedupeKey` (an internal dedup identity mechanism with no meaning to an
 * API consumer — the same "expose what's useful, not just what's in the
 * table" judgment `SlaPolicySummary` already applied to `branchId`/
 * `createdAt`/`updatedAt`).
 */
export interface NotificationSummary {
  id: string;
  eventType: string;
  ticketId: string;
  branchId: string | null;
  targetType: string | null;
  targetAt: Date | null;
  loggedAt: Date;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  /**
   * Story 36 — first real consumer of `NotificationLog` beyond the
   * listeners that write it. Scoped through the notification's own `ticket`
   * relation (`ticket.branchId`), **not** `NotificationLog.branchId`
   * itself: that column is nullable and is always left `null` for every
   * `ticket.escalated` row (see `TicketEscalatedNotificationListener`'s own
   * doc comment — its payload carries no `branchId`). `ticketId` is never
   * null and every `Ticket` has a real, non-nullable `branchId`, so
   * filtering through the relation is the only way to scope *every*
   * notification row to the caller's branch without silently dropping
   * every escalation notification — a real notification-history feature
   * must include those. The resolved `branchId` on each returned row
   * likewise falls back to `ticket.branchId` when the notification's own
   * column is null, so the exposed data is never confusingly inconsistent.
   */
  async listNotifications(): Promise<NotificationSummary[]> {
    const { branchId } = this.tenantContext.requireBranchScope();

    const notifications = await this.prisma.notificationLog.findMany({
      // Story 88 — `customerId: null` excludes `PortalNotificationLogListener`'s
      // rows (`ticket.updated`/agent-reply `channel.message.created`, scoped
      // to a customer, not this endpoint's branch-wide agent audience) so
      // this endpoint's result set is unchanged by that story.
      where: { ticket: { branchId }, customerId: null },
      include: { ticket: { select: { branchId: true } } },
      orderBy: { loggedAt: "desc" },
    });

    return notifications.map((notification) => ({
      id: notification.id,
      eventType: notification.eventType,
      ticketId: notification.ticketId,
      branchId: notification.branchId ?? notification.ticket.branchId,
      targetType: notification.targetType,
      targetAt: notification.targetAt,
      loggedAt: notification.loggedAt,
    }));
  }

  /**
   * Story 88 — the Customer Portal's counterpart to `listNotifications()`.
   * Reuses the exact same `NotificationSummary` shape — `branchId`/
   * `targetType`/`targetAt` are simply always `null` for these rows,
   * exactly as consistent as `ticket.escalated` rows already are for the
   * agent-facing endpoint (see this file's own doc comment above). No
   * `ticket` relation join needed (unlike `listNotifications`, which
   * resolves `branchId` through it) since `customerId` is a first-class,
   * directly-filterable column on rows this method returns.
   */
  async listNotificationsForCustomer(customerId: string): Promise<NotificationSummary[]> {
    const notifications = await this.prisma.notificationLog.findMany({
      where: { customerId },
      orderBy: { loggedAt: "desc" },
    });

    return notifications.map((notification) => ({
      id: notification.id,
      eventType: notification.eventType,
      ticketId: notification.ticketId,
      branchId: notification.branchId,
      targetType: notification.targetType,
      targetAt: notification.targetAt,
      loggedAt: notification.loggedAt,
    }));
  }
}
