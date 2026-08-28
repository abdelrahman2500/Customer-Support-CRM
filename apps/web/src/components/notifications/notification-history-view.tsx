"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useNotificationsQuery } from "@/hooks/use-notifications";
import { useCustomersQuery, useTicketsQuery } from "@/hooks/use-tickets";
import type { NotificationSummary } from "@/lib/notifications-api";
import { ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/** The real, backend-defined event-type strings this history can ever show
 * (`SLA_AT_RISK_EVENT`/`SLA_BREACHED_EVENT`/`TICKET_ESCALATED_EVENT` —
 * confirmed against `sla-detection.events.ts`/`tickets.events.ts` and the
 * two `NotificationLog`-writing listeners during implementation). An
 * unrecognized value (a future event type) falls back to the raw string
 * rather than a missing-translation crash. */
const EVENT_LABEL_KEYS: Record<string, string> = {
  "sla.at_risk": "eventLabel.slaAtRisk",
  "sla.breached": "eventLabel.slaBreached",
  "ticket.escalated": "eventLabel.ticketEscalated",
};

/** The only two real `targetType` values the backend ever emits (`response`/
 * `resolution` — see `SlaAtRiskEvent`/`SlaBreachedEvent`); `null` (every
 * `ticket.escalated` row, which carries no target) is handled separately as
 * "no target" rather than falling through here. */
const TARGET_TYPE_LABEL_KEYS: Record<string, string> = {
  response: "targetType.response",
  resolution: "targetType.resolution",
};

/**
 * One notification row's ticket/customer cells, resolved through the
 * already-fetched, already-shared `useTicketsQuery({})`/`useCustomersQuery()`
 * caches — the same client-side-join convention `TicketListView`'s
 * `customerNameById`/`AuditLogView`'s `ActorCell` already established. A
 * ticket this branch's unpaginated ticket list doesn't contain (e.g. one
 * outside this lookup) falls back to the raw `ticketId`, exactly like those
 * existing fallbacks.
 */
function NotificationRow({
  notification,
  ticketSubject,
  customerName,
  onOpenTicket,
}: {
  notification: NotificationSummary;
  ticketSubject: string | undefined;
  customerName: string | undefined;
  onOpenTicket: () => void;
}) {
  const t = useTranslations("notificationHistory");
  const { locale } = useParams<{ locale: string }>();

  const eventLabelKey = EVENT_LABEL_KEYS[notification.eventType];
  const targetTypeLabelKey = notification.targetType
    ? TARGET_TYPE_LABEL_KEYS[notification.targetType]
    : undefined;

  return (
    <TableRow>
      <TableCell>
        <Badge variant="outline">{eventLabelKey ? t(eventLabelKey) : notification.eventType}</Badge>
      </TableCell>
      <TableCell>
        <button type="button" className="hover:underline" onClick={onOpenTicket}>
          {ticketSubject ?? notification.ticketId}
        </button>
      </TableCell>
      <TableCell className="text-slate-500">
        {customerName ?? <span className="text-slate-400">{t("unknownCustomer")}</span>}
      </TableCell>
      <TableCell className="text-slate-500">
        {notification.targetType && notification.targetAt ? (
          <>
            {targetTypeLabelKey ? t(targetTypeLabelKey) : notification.targetType}
            {" · "}
            {new Date(notification.targetAt).toLocaleString(locale)}
          </>
        ) : (
          <span className="text-slate-400">{t("noTarget")}</span>
        )}
      </TableCell>
      <TableCell className="text-slate-500">
        {new Date(notification.loggedAt).toLocaleString(locale)}
      </TableCell>
    </TableRow>
  );
}

/**
 * Story 39 — Agent Workspace: Notification History, over the already-
 * existing `GET /notifications` (Story 36, never before consumed by any
 * frontend). Entirely read-only — no mutation exists anywhere on this
 * screen. Mirrors `AuditLogView`'s (Story 40's) structure closely, since
 * both are read-only histories behind a permission a plain Agent does not
 * hold: the query-level 403 is distinguished from a generic failure the
 * same way — its own message with no retry action, since retrying with the
 * same permissions cannot change the outcome — rather than a mutation's
 * `actionForbidden`/`actionFailed` pair, since nothing here ever mutates.
 *
 * The backend already returns rows ordered `loggedAt: desc` (newest first,
 * `NotificationsService.listNotifications`'s own `orderBy`); this view
 * renders them in that same order rather than re-sorting client-side.
 *
 * Ticket subject / customer name resolution reuses the existing,
 * already-fetched, unpaginated `useTicketsQuery({})`/`useCustomersQuery()`
 * (same client-side-join precedent as `TicketListView`/`CustomerDetailView`'s
 * "Related tickets" and `AuditLogView`'s `useUsersQuery()`-based
 * `ActorCell`) — no new backend endpoint/parameter, and neither hook is
 * modified. A resolution failure never blocks the notification list itself
 * from rendering (same independent-failure convention as
 * `CustomerDetailView`'s Contacts/Related-Tickets cards or `RoleListView`'s
 * roles/permissions sections): an unresolved row falls back to the raw
 * `ticketId`/an "unknown customer" label.
 */
export function NotificationHistoryView() {
  const t = useTranslations("notificationHistory");
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();

  const notificationsQuery = useNotificationsQuery();
  const ticketsQuery = useTicketsQuery({});
  const customersQuery = useCustomersQuery();

  const ticketById = useMemo(() => {
    const map = new Map<string, { subject: string; customerId: string }>();
    for (const ticket of ticketsQuery.data ?? []) {
      map.set(ticket.id, { subject: ticket.subject, customerId: ticket.customerId });
    }
    return map;
  }, [ticketsQuery.data]);

  const customerNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const customer of customersQuery.data ?? []) {
      map.set(customer.id, customer.displayName);
    }
    return map;
  }, [customersQuery.data]);

  const forbidden =
    notificationsQuery.isError &&
    notificationsQuery.error instanceof ApiError &&
    notificationsQuery.error.status === 403;

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-slate-900">{t("title")}</h1>

      {notificationsQuery.isLoading && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((row) => (
            <Skeleton key={row} className="h-10 w-full" />
          ))}
        </div>
      )}

      {notificationsQuery.isError && forbidden && (
        <Alert variant="destructive">{t("forbidden")}</Alert>
      )}

      {notificationsQuery.isError && !forbidden && (
        <Alert variant="destructive" className="flex items-center justify-between">
          <span>{t("error")}</span>
          <Button variant="outline" size="sm" onClick={() => notificationsQuery.refetch()}>
            {t("retry")}
          </Button>
        </Alert>
      )}

      {notificationsQuery.isSuccess && notificationsQuery.data.length === 0 && (
        <p className="rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          {t("empty")}
        </p>
      )}

      {notificationsQuery.isSuccess && notificationsQuery.data.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.event")}</TableHead>
                <TableHead>{t("columns.ticket")}</TableHead>
                <TableHead>{t("columns.customer")}</TableHead>
                <TableHead>{t("columns.target")}</TableHead>
                <TableHead>{t("columns.loggedAt")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notificationsQuery.data.map((notification) => {
                const ticket = ticketById.get(notification.ticketId);
                const customerName = ticket ? customerNameById.get(ticket.customerId) : undefined;
                return (
                  <NotificationRow
                    key={notification.id}
                    notification={notification}
                    ticketSubject={ticket?.subject}
                    customerName={customerName}
                    onOpenTicket={() => router.push(`/${locale}/tickets/${notification.ticketId}`)}
                  />
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
