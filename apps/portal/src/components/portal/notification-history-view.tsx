"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  useMarkNotificationsReadMutation,
  useMyNotificationsQuery,
} from "@/hooks/use-portal-notification-history";
import { useMyTicketsQuery } from "@/hooks/use-portal-tickets";
import type { PortalNotificationSummary } from "@/lib/notifications-api";
import { NotificationPreferencesSection } from "./notification-preferences-section";
import { Skeleton } from "@crm/ui";

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
 */
export function NotificationHistoryView() {
  const t = useTranslations("notifications");
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();

  const notificationsQuery = useMyNotificationsQuery();
  const ticketsQuery = useMyTicketsQuery();
  const markReadMutation = useMarkNotificationsReadMutation();

  const hasMarkedReadRef = useRef(false);
  useEffect(() => {
    if (notificationsQuery.isSuccess && !hasMarkedReadRef.current) {
      hasMarkedReadRef.current = true;
      markReadMutation.mutate();
    }
  }, [notificationsQuery.isSuccess, markReadMutation]);

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

      <NotificationPreferencesSection />

      {/* Story 97 — Loading & Skeleton UX. A real, column-shaped table
          (matching the eventual populated table's own headers/columns
          exactly) rather than the previous generic full-width row bars,
          which gave no hint of the 3-column structure about to appear. */}
      {notificationsQuery.isLoading && (
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-start text-slate-500">
                <th className="px-4 py-2 font-medium">{t("history.columns.event")}</th>
                <th className="px-4 py-2 font-medium">{t("history.columns.ticket")}</th>
                <th className="px-4 py-2 font-medium">{t("history.columns.loggedAt")}</th>
              </tr>
            </thead>
            {/* Only the placeholder rows themselves are hidden from
                assistive tech — the headers above are the same real
                headers the populated table uses and stay announced. */}
            <tbody aria-hidden="true">
              {[0, 1, 2, 3, 4].map((row) => (
                <tr key={row} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2">
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </td>
                  <td className="px-4 py-2">
                    <Skeleton className="h-4 w-32" />
                  </td>
                  <td className="px-4 py-2">
                    <Skeleton className="h-4 w-24" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

      {notificationsQuery.isSuccess && notificationsQuery.data.length === 0 && (
        <p className="rounded-md border border-dashed border-rule-strong p-8 text-center text-sm text-ink-subtle">
          {t("history.empty")}
        </p>
      )}

      {notificationsQuery.isSuccess && notificationsQuery.data.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-start text-slate-500">
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
                    <Link
                      href={`/${locale}/tickets/${notification.ticketId}`}
                      className="focus-ring rounded-sm hover:underline"
                    >
                      {ticketSubjectById.get(notification.ticketId) ?? notification.ticketId}
                    </Link>
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
