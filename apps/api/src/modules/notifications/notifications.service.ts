import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContext } from "../../common/tenant/tenant-context";
import { paginate } from "../../common/pagination/paginate";
import type { Paginated } from "../../common/pagination/paginated";
import type { ListNotificationsQueryDto } from "./dto/list-notifications-query.dto";

/**
 * Story 36 — mirrors the real `NotificationLog` Prisma model, minus
 * `dedupeKey` (an internal dedup identity mechanism with no meaning to an
 * API consumer — the same "expose what's useful, not just what's in the
 * table" judgment `SlaPolicySummary` already applied to `branchId`/
 * `createdAt`/`updatedAt`).
 */
export interface NotificationSummary {
  /**
   * Story S-8d — the related ticket's subject and its customer's display
   * name, resolved server-side.
   *
   * The notification history screen used to resolve both by fetching the
   * entire ticket and customer lists and building id -> name maps in the
   * browser; its own comment described them as the "already-fetched,
   * unpaginated" queries. Both are now paginated, so those maps would
   * cover 25 rows out of thousands and nearly every notification would
   * render a raw UUID.
   *
   * `null` when the ticket has been deleted, which the screen already
   * handles by falling back to the id.
   */
  ticketSubject: string | null;
  customerName: string | null;
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
  async listNotifications(
    query: ListNotificationsQueryDto = {},
  ): Promise<Paginated<NotificationSummary>> {
    const { branchId } = this.tenantContext.requireBranchScope();
    const userId = this.tenantContext.userId;
    if (!userId) {
      throw new Error("TenantContext: no active user on this request");
    }

    // Story 88 — `customerId: null` excludes `PortalNotificationLogListener`'s
    // rows (`ticket.updated`/agent-reply `channel.message.created`, scoped
    // to a customer, not this endpoint's branch-wide agent audience) so
    // this endpoint's result set is unchanged by that story.
    //
    // RM-06 — `recipientUserId` narrows further: a row with `null` there
    // (every notification before this story, and every branch-wide one
    // since) stays visible to the whole branch as always; a row with it
    // set (a `ticket.mentioned` row) is visible only to that one recipient
    // — this is the enforcement point for "notifies no one else" outside
    // realtime, since a mentioned agent's history/unread-count must show
    // it and every other agent's must not.
    //
    // Story S-8b — lifted into a named constant so `paginate` can issue the
    // count and the page from this one object. That matters more here than
    // for most endpoints: the branch scope runs through the `ticket`
    // relation rather than `NotificationLog.branchId` (which is nullable
    // and always null for escalation rows — see this method's doc comment),
    // so a `count` that rebuilt the predicate and reached for the column
    // instead would silently exclude every escalation from `total` while
    // `items` still contained them.
    const where = {
      ticket: { branchId },
      customerId: null,
      OR: [{ recipientUserId: null }, { recipientUserId: userId }],
    };

    /**
     * Story S-8b — `take: MAX_NOTIFICATION_ROWS` (200) replaced by real
     * paging. Story 106 justified that cap as "recent activity, not a full
     * archive", which held while there was no way to ask for more; now that
     * there is, an agent can reach the older half of the feed instead of it
     * silently ending at 200.
     *
     * `id` is the ordering tiebreaker. `loggedAt` is not unique: SLA and
     * escalation listeners write several rows for one event, and
     * `@@unique([eventType, ticketId, targetType, targetAt])` on this table
     * shows how closely-related rows cluster. Ordering on `loggedAt` alone
     * would let a row straddling a page boundary appear on both pages or
     * neither.
     */
    const { items: notifications, ...pagination } = await paginate(this.prisma.notificationLog, {
      where,
      orderBy: [{ loggedAt: "desc" }, { id: "desc" }],
      page: query.page,
      pageSize: query.pageSize,
    });

    /**
     * One extra query for the page, not a join.
     *
     * `paginate` drives a Prisma delegate and infers its row type from it,
     * so threading an `include` through would mean giving up that
     * inference. Resolving afterwards keeps the pagination path plain and
     * costs a single `findMany` over at most `pageSize` ids — 25 by
     * default — which is bounded in a way the client-side maps never were.
     */
    const ticketIds = [...new Set(notifications.map((notification) => notification.ticketId))];
    const tickets = ticketIds.length
      ? await this.prisma.ticket.findMany({
          where: { id: { in: ticketIds } },
          select: { id: true, subject: true, customer: { select: { displayName: true } } },
        })
      : [];
    const ticketById = new Map(tickets.map((ticket) => [ticket.id, ticket]));

    return {
      ...pagination,
      items: notifications.map((notification) => ({
        id: notification.id,
        eventType: notification.eventType,
        ticketId: notification.ticketId,
        ticketSubject: ticketById.get(notification.ticketId)?.subject ?? null,
        customerName: ticketById.get(notification.ticketId)?.customer?.displayName ?? null,
        // Story S-8b — was `?? notification.ticket.branchId`, which needed
        // the `ticket` relation eager-loaded purely to read one column.
        // `where` already constrains `ticket: { branchId }`, so every row
        // here has `ticket.branchId === branchId` by construction and the
        // join could only ever produce that same value. Reading it from the
        // tenant scope is identical output with one fewer join, and keeps the
        // row shape plain enough for `paginate` to infer.
        branchId: notification.branchId ?? branchId,
        targetType: notification.targetType,
        targetAt: notification.targetAt,
        loggedAt: notification.loggedAt,
      })),
    };
  }

  /**
   * Story 92 — the agent's own unread count, reusing `listNotifications()`'s
   * exact scoping predicate (branch via the `ticket` relation,
   * `customerId: null`, RM-06's `recipientUserId` filter) plus a
   * `loggedAt` cursor filter. A `null` `notificationsReadAt` (never marked
   * read) omits the cursor filter entirely, so every matching row counts
   * as unread — never treated as "0 unread" or an error. `NotificationLog`
   * itself carries no read state; the cursor lives on the caller's own
   * `User` row precisely because these rows are shared by every agent in
   * the branch (see this file's own `listNotifications` doc comment) —
   * one agent's cursor can never affect another's count.
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
        OR: [{ recipientUserId: null }, { recipientUserId: userId }],
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
  /** Story S-8d — `ticketSubject`/`customerName` are `null` here for the
   * same reason `branchId`/`targetType` already are: the portal screen
   * shows its own ticket links and never needed either. Keeping one shape
   * matters more than trimming two nulls. */
  /**
   * PORTAL-2 — paginated via the same `paginate()` helper and `id`
   * tie-breaker `listNotifications()` above already uses; no `include`
   * needed (unlike `TicketsService.listTicketsForCustomer`'s wrapped
   * delegate), so the plain Prisma delegate is passed straight through.
   * No `sortBy`/filter params are added — this list has none, mirroring
   * `ListPortalNotificationsQueryDto`'s "endpoint has no filters to
   * preserve" precedent.
   */
  async listNotificationsForCustomer(
    customerId: string,
    pagination: { page?: number; pageSize?: number } = {},
  ): Promise<Paginated<NotificationSummary>> {
    const { items: notifications, ...page } = await paginate(this.prisma.notificationLog, {
      where: { customerId },
      orderBy: [{ loggedAt: "desc" }, { id: "desc" }],
      page: pagination.page,
      pageSize: pagination.pageSize,
    });

    return {
      ...page,
      items: notifications.map((notification) => ({
        id: notification.id,
        eventType: notification.eventType,
        ticketId: notification.ticketId,
        ticketSubject: null,
        customerName: null,
        branchId: notification.branchId,
        targetType: notification.targetType,
        targetAt: notification.targetAt,
        loggedAt: notification.loggedAt,
      })),
    };
  }
}
