"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useNavigatingRouter as useRouter } from "@/hooks/use-navigating-router";
import { useNotificationsStore } from "@/lib/notifications-store";
import type {
  BranchNotification,
  SlaDetectionNotificationPayload,
  TicketEscalatedNotificationPayload,
} from "@/lib/notifications-store";
import { renderNotificationTemplate } from "@/lib/notification-template-render";
import {
  Badge,
  Button,
  CloseIcon,
  cn,
  toastCardClassName,
  toastListClassName,
  toastRegionClassName,
  toastToneClassName,
} from "@crm/ui";

function isSlaDetectionPayload(
  notification: BranchNotification,
): notification is BranchNotification & { payload: SlaDetectionNotificationPayload } {
  return notification.eventType === "sla.at_risk" || notification.eventType === "sla.breached";
}

function isTicketEscalatedPayload(
  notification: BranchNotification,
): notification is BranchNotification & { payload: TicketEscalatedNotificationPayload } {
  return notification.eventType === "ticket.escalated";
}

/** The real ticket id each notification carries, if any — used only to
 * offer click-through to the existing `tickets/[id]` route (Story 23).
 * No new route, no new endpoint: both event shapes already carry a real,
 * existing ticket id (Story 22's own payloads), so navigating there is
 * safe without inventing anything. */
/** next-intl resolves a dotted `t()` argument as a nested-object path, so
 * an event-type string like `"ticket.escalated"` can't be used directly as
 * a message key — it would look for `eventLabel.ticket.escalated` (three
 * levels) rather than a single key literally named `"ticket.escalated"`.
 * This maps the three existing, unmodified event-type strings to the
 * camelCase message keys `messages/{en,ar}.json` actually defines. */
const EVENT_LABEL_KEY: Record<
  BranchNotification["eventType"],
  "slaAtRisk" | "slaBreached" | "ticketEscalated"
> = {
  "sla.at_risk": "slaAtRisk",
  "sla.breached": "slaBreached",
  "ticket.escalated": "ticketEscalated",
};

function ticketIdFor(notification: BranchNotification): string | null {
  if (isSlaDetectionPayload(notification)) {
    return notification.payload.ticketId;
  }
  if (isTicketEscalatedPayload(notification)) {
    return notification.payload.ticket.id;
  }
  return null;
}

/**
 * Story 24 — renders the transient branch-notification stack. Mounted once
 * alongside `useBranchNotifications` (see `BranchNotifications`), fixed to
 * a corner using logical (RTL-safe) positioning (`top-*`/`end-*`, not
 * `right-*`), so it renders correctly under both `dir="ltr"` and
 * `dir="rtl"` (`docs/architecture/10-i18n-and-rtl.md`). Purely presentational
 * — no persistence, no read/unread state; a notification's only lifecycle
 * is "shown" -> "dismissed" (manually or via the store's own auto-dismiss
 * timer).
 *
 * Story 63 — `templateByEventType` (built by `BranchNotifications` from
 * `useNotificationTemplatesQuery()`) replaces only the message body via
 * `messageFor()` when a custom template exists for a notification's event
 * type; the Badge's plain event-type label is deliberately untouched
 * (Design decision 2 of the plan) — falls back to the exact existing
 * message when the map has no entry for that event type (including while
 * still loading, since the caller passes an empty map until then).
 *
 * Story 190 (RD-1.13) — the shared toast region/card (`lib/toast.ts` in
 * @crm/ui): 320px-safe, and the labelled region with its polite live list
 * stays mounted while empty so the first notification is announced.
 * Breached cards keep the danger border; at-risk/escalated cards use the
 * warning border, matching their warning Badge.
 */
export function NotificationToaster({
  templateByEventType = new Map(),
}: {
  templateByEventType?: Map<string, string>;
}) {
  const t = useTranslations("notifications");
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const notifications = useNotificationsStore((state) => state.notifications);
  const dismiss = useNotificationsStore((state) => state.dismiss);

  return (
    <div role="region" aria-label={t("regionLabel")} className={cn(toastRegionClassName, "top-4")}>
      <ol aria-live="polite" className={toastListClassName}>
        {notifications.map((notification) => {
          const ticketId = ticketIdFor(notification);
          return (
            <li
              key={notification.id}
              className={cn(
                toastCardClassName,
                "flex-col gap-2",
                notification.eventType === "sla.breached"
                  ? toastToneClassName.error
                  : toastToneClassName.warning,
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <Badge
                  variant={notification.eventType === "sla.breached" ? "destructive" : "warning"}
                >
                  {t(`eventLabel.${EVENT_LABEL_KEY[notification.eventType]}`)}
                </Badge>
                <button
                  type="button"
                  aria-label={t("dismiss")}
                  onClick={() => dismiss(notification.id)}
                  className="focus-ring rounded-inner text-ink-subtle hover:text-ink"
                >
                  {/* Story S-5: the shared close glyph, matching Dialog and
                    SuccessToaster. The button carries aria-label, so the
                    icon is decorative. */}
                  <CloseIcon className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <p className="text-sm text-ink-strong">
                {messageFor(notification, t, templateByEventType.get(notification.eventType))}
              </p>
              {ticketId && (
                <Button
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={() => {
                    dismiss(notification.id);
                    router.push(`/${locale}/tickets/${ticketId}`);
                  }}
                >
                  {t("viewTicket")}
                </Button>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function messageFor(
  notification: BranchNotification,
  t: ReturnType<typeof useTranslations<"notifications">>,
  template: string | undefined,
): string {
  if (template) {
    return renderNotificationTemplate(template, {
      ticketId: ticketIdFor(notification) ?? "",
      targetType: isSlaDetectionPayload(notification) ? notification.payload.targetType : undefined,
    });
  }
  if (isSlaDetectionPayload(notification)) {
    const { ticketId, targetType } = notification.payload;
    const key = notification.eventType === "sla.breached" ? "slaBreached" : "slaAtRisk";
    return t(key, {
      targetType: t(`targetType.${targetType}`),
      ticketId: ticketId.slice(0, 8),
    });
  }
  if (isTicketEscalatedPayload(notification)) {
    return t("ticketEscalated", { subject: notification.payload.ticket.subject });
  }
  return t("generic");
}
