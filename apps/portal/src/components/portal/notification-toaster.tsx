"use client";

import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@crm/ui";
import { usePortalNotificationsStore } from "@/lib/notifications-store";
import type {
  ChannelMessageNotificationPayload,
  PortalNotification,
  TicketUpdatedNotificationPayload,
} from "@/lib/notifications-store";

const BODY_PREVIEW_LENGTH = 120;

function isTicketUpdatedPayload(
  notification: PortalNotification,
): notification is PortalNotification & { payload: TicketUpdatedNotificationPayload } {
  return notification.eventType === "ticket.updated";
}

function isChannelMessagePayload(
  notification: PortalNotification,
): notification is PortalNotification & { payload: ChannelMessageNotificationPayload } {
  return notification.eventType === "channel.message.created";
}

function ticketIdFor(notification: PortalNotification): string {
  if (isTicketUpdatedPayload(notification)) {
    return notification.payload.ticket.id;
  }
  if (isChannelMessagePayload(notification)) {
    return notification.payload.ticketId;
  }
  return "";
}

/**
 * Story 86 — renders the Customer Portal's transient notification stack,
 * mirroring `apps/web`'s `NotificationToaster` shape exactly: mounted
 * once alongside `usePortalNotifications` (see `PortalNotifications`),
 * fixed to a corner using logical (RTL-safe) positioning (`top-*`/`end-*`,
 * not `right-*`), purely presentational — no persistence, no read/unread
 * state, no notification-template substitution (Non-Goal, unlike
 * `apps/web`'s own later Story 63 enhancement).
 */
export function NotificationToaster() {
  const t = useTranslations("notifications");
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const notifications = usePortalNotificationsStore((state) => state.notifications);
  const dismiss = usePortalNotificationsStore((state) => state.dismiss);

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
            className="pointer-events-auto flex flex-col gap-2 rounded-md border border-slate-200 bg-white p-3 shadow-md"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-semibold text-slate-900">
                {t(
                  `eventLabel.${notification.eventType === "ticket.updated" ? "ticketUpdated" : "newReply"}`,
                )}
              </span>
              <button
                type="button"
                aria-label={t("dismiss")}
                onClick={() => dismiss(notification.id)}
                className="text-ink-subtle hover:text-slate-600"
              >
                ×
              </button>
            </div>
            <p className="text-sm text-slate-800">{messageFor(notification, t)}</p>
            <Button
              type="button"
              onClick={() => {
                dismiss(notification.id);
                router.push(`/${locale}/tickets/${ticketId}`);
              }}
              variant="outline"
              size="sm"
              className="w-fit self-start text-sm"
            >
              {t("viewTicket")}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

function messageFor(
  notification: PortalNotification,
  t: ReturnType<typeof useTranslations<"notifications">>,
): string {
  if (isTicketUpdatedPayload(notification)) {
    return t("ticketUpdated", {
      subject: notification.payload.ticket.subject,
      status: notification.payload.ticket.status,
    });
  }
  if (isChannelMessagePayload(notification)) {
    const preview = notification.payload.message.body.slice(0, BODY_PREVIEW_LENGTH);
    const truncated = notification.payload.message.body.length > BODY_PREVIEW_LENGTH;
    return `${t("newReply")} ${preview}${truncated ? "…" : ""}`.trim();
  }
  return t("generic");
}
