"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMyNotificationsQuery } from "@/hooks/use-portal-notification-history";
import { useMyTicketsQuery } from "@/hooks/use-portal-tickets";
import type { PortalNotificationSummary } from "@/lib/notifications-api";

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
 */
export function NotificationHistoryView() {
  const t = useTranslations("notifications");
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();

  const notificationsQuery = useMyNotificationsQuery();
  const ticketsQuery = useMyTicketsQuery();

  const ticketSubjectById = useMemo(() => {
    const map = new Map<string, string>();
    for (const ticket of ticketsQuery.data ?? []) {
      map.set(ticket.id, ticket.subject);
    }
    return map;
  }, [ticketsQuery.data]);

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-slate-900">{t("history.title")}</h1>

      {notificationsQuery.isLoading && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((row) => (
            <div key={row} className="h-10 w-full animate-pulse rounded-md bg-slate-100" />
          ))}
        </div>
      )}

      {notificationsQuery.isError && (
        <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>{t("history.error")}</span>
          <button
            type="button"
            onClick={() => notificationsQuery.refetch()}
            className="rounded-md border border-red-300 bg-white px-2 py-1 text-xs font-medium hover:bg-red-50"
          >
            {t("history.retry")}
          </button>
        </div>
      )}

      {notificationsQuery.isSuccess && notificationsQuery.data.length === 0 && (
        <p className="rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          {t("history.empty")}
        </p>
      )}

      {notificationsQuery.isSuccess && notificationsQuery.data.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="px-4 py-2 font-medium">{t("history.columns.event")}</th>
                <th className="px-4 py-2 font-medium">{t("history.columns.ticket")}</th>
                <th className="px-4 py-2 font-medium">{t("history.columns.loggedAt")}</th>
              </tr>
            </thead>
            <tbody>
              {notificationsQuery.data.map((notification: PortalNotificationSummary) => (
                <tr key={notification.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2">
                    <span className="rounded-full border border-slate-300 px-2 py-0.5 text-xs">
                      {t(eventLabelKeyFor(notification.eventType))}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      className="hover:underline"
                      onClick={() => router.push(`/${locale}/tickets/${notification.ticketId}`)}
                    >
                      {ticketSubjectById.get(notification.ticketId) ?? notification.ticketId}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-slate-500">
                    {new Date(notification.loggedAt).toLocaleString(locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
