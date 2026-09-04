"use client";

import { useEffect, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMarkNotificationsReadMutation, useNotificationsQuery } from "@/hooks/use-notifications";
import { useNotificationTemplatesQuery } from "@/hooks/use-notification-templates";
import { useCustomersQuery, useTicketsQuery } from "@/hooks/use-tickets";
import type { NotificationSummary } from "@/lib/notifications-api";
import { renderNotificationTemplate } from "@/lib/notification-template-render";
import { ApiError } from "@/lib/api";
import { Alert, Badge, Button, Skeleton } from "@crm/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@crm/ui";
import { NotificationPreferencesSection } from "./notification-preferences-section";

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
 *
 * Story 61 — `template` is the caller's own `NotificationTemplate.template`
 * for this row's `eventType`, when one exists; falls back to the exact
 * existing `EVENT_LABEL_KEYS`-driven label otherwise (zero behavior change
 * for any branch that has never created one).
 */
function NotificationRow({
  notification,
  ticketSubject,
  customerName,
  template,
  onOpenTicket,
}: {
  notification: NotificationSummary;
  ticketSubject: string | undefined;
  customerName: string | undefined;
  template: string | undefined;
  onOpenTicket: () => void;
}) {
  const t = useTranslations("notificationHistory");
  const { locale } = useParams<{ locale: string }>();

  const eventLabelKey = EVENT_LABEL_KEYS[notification.eventType];
  const targetTypeLabelKey = notification.targetType
    ? TARGET_TYPE_LABEL_KEYS[notification.targetType]
    : undefined;
  const eventLabel = template
    ? renderNotificationTemplate(template, {
        ticketId: notification.ticketId,
        targetType: notification.targetType,
      })
    : eventLabelKey
      ? t(eventLabelKey)
      : notification.eventType;

  return (
    <TableRow>
      <TableCell>
        <Badge variant="outline">{eventLabel}</Badge>
      </TableCell>
      <TableCell>
        <button
          type="button"
          className="rounded-sm hover:underline focus-ring"
          onClick={onOpenTicket}
        >
          {ticketSubject ?? notification.ticketId}
        </button>
      </TableCell>
      <TableCell className="text-slate-500">
        {customerName ?? <span className="text-ink-subtle">{t("unknownCustomer")}</span>}
      </TableCell>
      <TableCell className="text-slate-500">
        {notification.targetType && notification.targetAt ? (
          <>
            {targetTypeLabelKey ? t(targetTypeLabelKey) : notification.targetType}
            {" · "}
            {new Date(notification.targetAt).toLocaleString(locale)}
          </>
        ) : (
          <span className="text-ink-subtle">{t("noTarget")}</span>
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
 *
 * Story 58 — `NotificationPreferencesSection` rendered above the history
 * table, entirely independent of `notificationsQuery`'s own `notification:read`
 * gate: a user lacking that permission must still be able to manage their
 * own live toast preferences.
 *
 * Story 61 — `templatesQuery` is its own, independent query: a loading or
 * errored fetch never blocks the notification list itself from rendering
 * (same independent-failure convention already established for
 * ticket/customer name resolution above) — every row simply falls back to
 * its default label until templates are available.
 *
 * Story 92 — marks the caller's notifications read exactly once per
 * successful mount of this view (never on loading/error/403 — gated on
 * `notificationsQuery.isSuccess`), via `useMarkNotificationsReadMutation()`.
 * A `useRef` guard, not an effect dependency array trick, is what makes
 * this "once" rather than "every time the query refetches/re-succeeds"
 * (e.g. on window refocus).
 */
export function NotificationHistoryView() {
  const t = useTranslations("notificationHistory");
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();

  const notificationsQuery = useNotificationsQuery();
  const ticketsQuery = useTicketsQuery({});
  const customersQuery = useCustomersQuery();
  const templatesQuery = useNotificationTemplatesQuery();
  const markReadMutation = useMarkNotificationsReadMutation();

  const hasMarkedReadRef = useRef(false);
  useEffect(() => {
    if (notificationsQuery.isSuccess && !hasMarkedReadRef.current) {
      hasMarkedReadRef.current = true;
      markReadMutation.mutate();
    }
  }, [notificationsQuery.isSuccess, markReadMutation]);

  const templateByEventType = useMemo(() => {
    const map = new Map<string, string>();
    for (const template of templatesQuery.data ?? []) {
      map.set(template.eventType, template.template);
    }
    return map;
  }, [templatesQuery.data]);

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

      <NotificationPreferencesSection />

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
        <p className="rounded-md border border-dashed border-rule-strong p-8 text-center text-sm text-ink-subtle">
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
                    template={templateByEventType.get(notification.eventType)}
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
