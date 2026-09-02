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

/** Story 106 — mirrors `AuditLogsService`'s own `MAX_AUDIT_LOG_ROWS`
 * precedent (Story 104): an agent-facing activity feed, the same
 * "recent activity, not a full archive" semantics as the audit trail.
 * `listNotifications` already orders by a fixed `loggedAt: "desc"` with
 * no user-configurable direction, so a plain `take` is sufficient — no
 * fetch-desc-then-reverse fix needed (unlike `Ticket`/`Customer`'s
 * configurable `sortDir`). */
const MAX_NOTIFICATION_ROWS = 200;

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
      take: MAX_NOTIFICATION_ROWS,
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
   * Story 92 — the agent's own unread count, reusing `listNotifications()`'s
   * exact scoping predicate (branch via the `ticket` relation,
   * `customerId: null`) plus a `loggedAt` cursor filter. A `null`
   * `notificationsReadAt` (never marked read) omits the cursor filter
   * entirely, so every matching row counts as unread — never treated as
   * "0 unread" or an error. `NotificationLog` itself carries no read state;
   * the cursor lives on the caller's own `User` row precisely because these
   * rows are shared by every agent in the branch (see this file's own
   * `listNotifications` doc comment) — one agent's cursor can never affect
   * another's count.
   */
  async getUnreadCount(): Promise<{ unreadCount: number }> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const userId = this.tenantContext.userId;
    if (!userId) {
      throw new Error("TenantContext: no active user on this request");
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { notificationsReadAt: true },
    });

    const unreadCount = await this.prisma.notificationLog.count({
      where: {
        ticket: { branchId },
        customerId: null,
        ...(user.notificationsReadAt ? { loggedAt: { gt: user.notificationsReadAt } } : {}),
      },
    });

    return { unreadCount };
  }

  /**
   * Story 92 — advances the calling agent's own cursor to the server's
   * current time. No id is ever accepted from the caller: `userId` is
   * resolved exclusively from `TenantContext` (validated token claims), so
   * this can never update another agent's `notificationsReadAt`.
   */
  async markRead(): Promise<{ readAt: Date }> {
    const userId = this.tenantContext.userId;
    if (!userId) {
      throw new Error("TenantContext: no active user on this request");
    }

    const readAt = new Date();
    await this.prisma.user.update({ where: { id: userId }, data: { notificationsReadAt: readAt } });
    return { readAt };
  }

  /**
   * Story 92 — the Customer Portal's counterpart to `getUnreadCount()`.
   * Scoped by `customerId` directly, mirroring `listNotificationsForCustomer`'s
   * own simpler predicate (no `ticket` relation join needed). The cursor
   * lives on the caller's own `Contact` row, not `Customer`: `contactId` is
   * the portal JWT's `sub` (the actual per-login identity — see
   * `PortalNotificationsController`), even though the notifications being
   * counted are shared by every `Contact` of that `Customer`. This is what
   * keeps two contacts under the same customer from ever affecting each
   * other's unread count.
   */
  async getUnreadCountForCustomer(
    contactId: string,
    customerId: string,
  ): Promise<{ unreadCount: number }> {
    const contact = await this.prisma.contact.findUniqueOrThrow({
      where: { id: contactId },
      select: { notificationsReadAt: true },
    });

    const unreadCount = await this.prisma.notificationLog.count({
      where: {
        customerId,
        ...(contact.notificationsReadAt ? { loggedAt: { gt: contact.notificationsReadAt } } : {}),
      },
    });

    return { unreadCount };
  }

  /**
   * Story 92 — advances the calling Contact's own cursor to the server's
   * current time. `contactId` is resolved exclusively by the caller
   * (`PortalNotificationsController`, from `getAuthenticatedContact(contact.sub)`),
   * never from a request body/param, so this can never update another
   * contact's `notificationsReadAt`.
   */
  async markReadForContact(contactId: string): Promise<{ readAt: Date }> {
    const readAt = new Date();
    await this.prisma.contact.update({
      where: { id: contactId },
      data: { notificationsReadAt: readAt },
    });
    return { readAt };
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
