"use client";

import { useTranslations } from "next-intl";
import {
  usePortalNotificationPreferencesQuery,
  useUpdatePortalNotificationPreferenceMutation,
} from "@/hooks/use-portal-notification-preferences";
import type { PortalNotificationPreferenceSummary } from "@/lib/notification-preferences-api";
import { useErrorMessage } from "@/hooks/use-error-message";
import { Button, Skeleton } from "@crm/ui";

/** The same two event-type strings `PORTAL_NOTIFICATION_EVENT_TYPES` names
 * on the backend (`apps/api/src/modules/notifications/
 * portal-notification-preferences.service.ts`) — reuses the existing
 * `notifications.eventLabel.*` keys, the exact same mapping
 * `NotificationToaster`/`NotificationHistoryView` already apply. */
const EVENT_LABEL_KEYS: Record<string, string> = {
  "ticket.updated": "eventLabel.ticketUpdated",
  "channel.message.created": "eventLabel.newReply",
};

/**
 * Story 90 — a self-contained, independently-rendered section (own query,
 * own error state), rendered above `NotificationHistoryView`'s existing
 * table. Mirrors `apps/web`'s `NotificationPreferencesSection` shape
 * exactly, plain Tailwind (no shared UI component library in
 * `apps/portal` — the same precedent every other portal view already
 * follows).
 */
export function NotificationPreferencesSection() {
  const t = useTranslations("notifications");
  const preferencesQuery = usePortalNotificationPreferencesQuery();

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">{t("preferences.heading")}</h2>
      <p className="mt-1 text-xs text-slate-500">{t("preferences.description")}</p>

      {preferencesQuery.isLoading && (
        <div className="mt-2 flex flex-col gap-2">
          {[0, 1].map((row) => (
            <Skeleton key={row} className="h-8 w-full" />
          ))}
        </div>
      )}

      {preferencesQuery.isError && (
        <div className="mt-2 flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>{t("preferences.error")}</span>
          <button
            type="button"
            onClick={() => preferencesQuery.refetch()}
            className="rounded-md border border-red-300 bg-white px-2 py-1 text-xs font-medium hover:bg-red-50 focus-ring"
          >
            {t("preferences.retry")}
          </button>
        </div>
      )}

      {preferencesQuery.isSuccess && (
        <ul className="mt-2 flex flex-col gap-2">
          {preferencesQuery.data.map((preference) => (
            <PreferenceRow key={preference.eventType} preference={preference} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** One event type's row — a dedicated component so
 * `useUpdatePortalNotificationPreferenceMutation` is called once per row,
 * mirroring `apps/web`'s own `PreferenceRow` Rules-of-Hooks convention. */
function PreferenceRow({ preference }: { preference: PortalNotificationPreferenceSummary }) {
  const t = useTranslations("notifications");
  const errorMessage = useErrorMessage();
  const mutation = useUpdatePortalNotificationPreferenceMutation();

  const labelKey = EVENT_LABEL_KEYS[preference.eventType];

  function toggle() {
    mutation.mutate({
      eventType: preference.eventType,
      inAppEnabled: !preference.inAppEnabled,
    });
  }

  return (
    <li className="flex items-center justify-between border-b border-slate-100 pb-2 text-sm">
      <span className="text-slate-700">{labelKey ? t(labelKey) : preference.eventType}</span>
      <div className="flex items-center gap-2">
        <span
          className={`rounded-full border px-2 py-0.5 text-xs ${
            preference.inAppEnabled
              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
              : "border-slate-300 bg-slate-50 text-slate-600"
          }`}
        >
          {preference.inAppEnabled ? t("preferences.enabled") : t("preferences.disabled")}
        </span>
        <Button
          type="button"
          disabled={mutation.isPending}
          onClick={toggle}
          variant="outline"
          size="sm"
          className="text-sm"
        >
          {preference.inAppEnabled ? t("preferences.disable") : t("preferences.enable")}
        </Button>
      </div>
      {mutation.isError && (
        <p className="mt-1 text-xs text-red-600">
          {errorMessage(mutation.error, {
            forbidden: t("preferences.actionForbidden"),
            generic: t("preferences.actionFailed"),
          })}
        </p>
      )}
    </li>
  );
}
