"use client";

import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useNotificationsStore } from "@/lib/notifications-store";
import type {
  BranchNotification,
  SlaDetectionNotificationPayload,
  TicketEscalatedNotificationPayload,
} from "@/lib/notifications-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
const EVENT_LABEL_KEY: Record<BranchNotification["eventType"], "slaAtRisk" | "slaBreached" | "ticketEscalated"> = {
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
 */
export function NotificationToaster() {
  const t = useTranslations("notifications");
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const notifications = useNotificationsStore((state) => state.notifications);
  const dismiss = useNotificationsStore((state) => state.dismiss);

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label={t("regionLabel")}
      className="pointer-events-none fixed top-4 end-4 z-50 flex w-full max-w-sm flex-col gap-2"
    >
      {notifications.map((notification) => {
        const ticketId = ticketIdFor(notification);
        return (
          <div
            key={notification.id}
            role="status"
            aria-live="polite"
            className={cn(
              "pointer-events-auto flex flex-col gap-2 rounded-md border bg-white p-3 shadow-md",
              notification.eventType === "sla.breached" ? "border-red-200" : "border-slate-200",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <Badge variant={notification.eventType === "sla.breached" ? "destructive" : "warning"}>
                {t(`eventLabel.${EVENT_LABEL_KEY[notification.eventType]}`)}
              </Badge>
              <button
                type="button"
                aria-label={t("dismiss")}
                onClick={() => dismiss(notification.id)}
                className="text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            </div>
            <p className="text-sm text-slate-800">{messageFor(notification, t)}</p>
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
          </div>
        );
      })}
    </div>
  );
}

function messageFor(
  notification: BranchNotification,
  t: ReturnType<typeof useTranslations<"notifications">>,
): string {
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
