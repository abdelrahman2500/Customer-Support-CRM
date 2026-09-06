"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  useMarkNotificationsReadMutation,
  useMyNotificationsQuery,
} from "@/hooks/use-portal-notification-history";
import { useMyTicketsQuery } from "@/hooks/use-portal-tickets";
import type { PortalNotificationSummary } from "@/lib/notifications-api";
import { NotificationPreferencesSection } from "./notification-preferences-section";
import {
  FetchingIndicator,
  Pagination,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@crm/ui";

const TICKET_UPDATED_EVENT = "ticket.updated";

/**
 * Maps a notification row's `eventType` to the *existing*
 * `notifications.eventLabel.*` i18n keys (`NotificationToaster` already
 * establishes this exact mapping) rather than declaring new ones. Story 88
 * guarantees a customer-scoped `NotificationLog` row's `eventType` is
 * always exactly `"ticket.updated"` or `"channel.message.created"`, so no
 * third branch/fallback is needed.
 */
function eventLabelKeyFor(eventType: string): string {
  return eventType === TICKET_UPDATED_EVENT ? "eventLabel.ticketUpdated" : "eventLabel.newReply";
}

/**
 * Story 89 — Customer Portal: Notification History (Frontend), over the
 * already-existing `GET /portal/notifications` (Story 88, never before
 * consumed by any frontend). Entirely read-only — no mutation exists
 * anywhere on this screen. Mirrors `apps/web`'s `NotificationHistoryView`
 * shape (loading skeleton / error+retry / empty / populated list), minus
 * its agent-only preferences/templates sections and its Customer/Target
 * columns — the portal is inherently single-customer-scoped, and Story 88
 * guarantees `targetType`/`targetAt` are always `null` for these rows, so
 * that column would never once be populated here.
 *
 * The backend already returns rows ordered `loggedAt: desc` (newest
 * first); this view renders them in that same order rather than
 * re-sorting client-side.
 *
 * Ticket subject resolution reuses the existing, already-fetched
 * `useMyTicketsQuery()` (Story 53) — same client-side-join precedent as
 * `apps/web`'s `NotificationHistoryView` resolving against its own
 * `useTicketsQuery({})`. No new backend parameter, and
 * `use-portal-tickets.ts` is not modified. A resolution failure/miss never
 * blocks the notification list itself from rendering — an unresolved row
 * simply falls back to the raw `ticketId`.
 *
 * Story 90 — renders `NotificationPreferencesSection` above the history
 * table (its own independent query/state, per that component's own doc
 * comment), giving the signed-in contact a place to mute either live toast
 * event type without leaving this page.
 *
 * Story 92 — marks the caller's notifications read exactly once per
 * successful mount of this view (never on loading/error), mirroring
 * `apps/web`'s `NotificationHistoryView` exactly (a `useRef` guard, not an
 * effect dependency trick, is what makes this "once").
 *
 * PORTAL-2 — Customer Portal Notification Pagination. `useMyNotificationsQuery`'s
 * response is now a `Paginated<PortalNotificationSummary>` envelope instead
 * of a flat array, mirroring `TicketListView`'s own page state/`Pagination`/
 * `FetchingIndicator` usage (PORTAL-1). The hand-rolled `<table>` markup is
 * also replaced by `@crm/ui`'s shared `Table` primitives here — the same
 * migration `apps/web`'s own `NotificationHistoryView` already completed
 * (Story S-8b) — so this is the last remaining raw `<table>` in either
 * frontend. No filtering/search/sort is added — this list has none of
 * those, unlike the agent workspace's own notification history.
 */
export function NotificationHistoryView() {
  const t = useTranslations("notifications");
  const tCommon = useTranslations("common");
  const { locale } = useParams<{ locale: string }>();
  /** 1-based; `undefined` until the reader pages. */
  const [page, setPage] = useState<number | undefined>(undefined);

  const notificationsQuery = useMyNotificationsQuery(page);
  const ticketsQuery = useMyTicketsQuery();
  const markReadMutation = useMarkNotificationsReadMutation();
  const notificationPage = notificationsQuery.data;
  const notifications = notificationPage?.items;

  const hasMarkedReadRef = useRef(false);
  useEffect(() => {
    if (notificationsQuery.isSuccess && !hasMarkedReadRef.current) {
      hasMarkedReadRef.current = true;
      markReadMutation.mutate();
    }
  }, [notificationsQuery.isSuccess, markReadMutation]);

  /**
   * PORTAL-1 — `useMyTicketsQuery()` now resolves a paginated envelope
   * (`.items`, page 1 by default) rather than every ticket the customer
   * has. This join was already documented above as a best-effort
   * resolution whose miss falls back to the raw `ticketId`, never a
   * blocking failure — a notification for a ticket outside the first page
   * now takes that same, already-existing fallback path instead of a hard
   * guarantee of resolution. Widening this join is a separate concern from
   * this screen's own pagination (PORTAL-2).
   */
  const ticketSubjectById = useMemo(() => {
    const map = new Map<string, string>();
    for (const ticket of ticketsQuery.data?.items ?? []) {
      map.set(ticket.id, ticket.subject);
    }
    return map;
  }, [ticketsQuery.data]);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-slate-900">{t("history.title")}</h1>
        {/* In the heading's own row, so it adds no height and cannot shift
            the table below it — mirrors TicketListView exactly. */}
        <FetchingIndicator
          active={notificationsQuery.isPlaceholderData}
          label={tCommon("updating")}
        />
      </div>

      <NotificationPreferencesSection />

      {/* Story 97 — Loading & Skeleton UX. A real, column-shaped table
          (matching the eventual populated table's own headers/columns
          exactly) rather than generic full-width row bars, which gave no
          hint of the 3-column structure about to appear. */}
      {notificationsQuery.isPending && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("history.columns.event")}</TableHead>
                <TableHead>{t("history.columns.ticket")}</TableHead>
                <TableHead>{t("history.columns.loggedAt")}</TableHead>
              </TableRow>
            </TableHeader>
            {/* Only the placeholder rows themselves are hidden from
                assistive tech — the headers above are the same real
                headers the populated table uses and stay announced. */}
            <TableBody aria-hidden="true">
              {[0, 1, 2, 3, 4].map((row) => (
                <TableRow key={row}>
                  <TableCell>
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {notificationsQuery.isError && (
        <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>{t("history.error")}</span>
          <button
            type="button"
            onClick={() => notificationsQuery.refetch()}
            className="rounded-md border border-red-300 bg-white px-2 py-1 text-xs font-medium hover:bg-red-50 focus-ring"
          >
            {t("history.retry")}
          </button>
        </div>
      )}

      {notifications !== undefined && notifications.length === 0 && (
        <p className="rounded-md border border-dashed border-rule-strong p-8 text-center text-sm text-ink-subtle">
          {t("history.empty")}
        </p>
      )}

      {notifications !== undefined && notifications.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("history.columns.event")}</TableHead>
                <TableHead>{t("history.columns.ticket")}</TableHead>
                <TableHead>{t("history.columns.loggedAt")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notifications.map((notification: PortalNotificationSummary) => (
                <TableRow key={notification.id}>
                  <TableCell>
                    <span className="rounded-full border border-slate-300 px-2 py-0.5 text-xs">
                      {t(eventLabelKeyFor(notification.eventType))}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/${locale}/tickets/${notification.ticketId}`}
                      className="focus-ring rounded-sm hover:underline"
                    >
                      {ticketSubjectById.get(notification.ticketId) ?? notification.ticketId}
                    </Link>
                  </TableCell>
                  <TableCell className="text-slate-500">
                    {new Date(notification.loggedAt).toLocaleString(locale)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {notificationPage !== undefined && (
        // Story S-8c — the shared pager, same primitive the agent
        // workspace and this portal's own ticket/KB lists use. Renders
        // nothing for a single page.
        <Pagination
          page={notificationPage.page}
          totalPages={notificationPage.totalPages}
          onPageChange={setPage}
          disabled={notificationsQuery.isPlaceholderData}
          label={tCommon("pagination.label")}
          previousLabel={tCommon("pagination.previous")}
          nextLabel={tCommon("pagination.next")}
          indicator={tCommon("pagination.indicator", {
            page: notificationPage.page,
            totalPages: notificationPage.totalPages,
          })}
        />
      )}
    </section>
  );
}
