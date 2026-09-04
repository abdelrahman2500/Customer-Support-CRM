"use client";

import { useTranslations } from "next-intl";
import {
  useNotificationPreferencesQuery,
  useUpdateNotificationPreferenceMutation,
} from "@/hooks/use-notification-preferences";
import type { NotificationPreferenceSummary } from "@/lib/notification-preferences-api";
import { ApiError } from "@/lib/api";
import { Alert, Badge, Button, Skeleton } from "@crm/ui";

/** The same three event-type strings `NOTIFICATION_EVENT_TYPES` names on the
 * backend (`apps/api/src/modules/notifications/notification-preferences.service.ts`)
 * — mirrors `EVENT_LABEL_KEYS` in `notification-history-view.tsx` exactly. */
const EVENT_LABEL_KEYS: Record<string, string> = {
  "sla.at_risk": "eventLabel.slaAtRisk",
  "sla.breached": "eventLabel.slaBreached",
  "ticket.escalated": "eventLabel.ticketEscalated",
};

/**
 * Story 58 — a self-contained, independently-rendered section (own query,
 * own error state) — deliberately never nested inside
 * `NotificationHistoryView`'s `notification:read`-gated conditional: a user
 * lacking that permission must still be able to manage their own live
 * toast preferences (Design decision 5 of the plan).
 */
export function NotificationPreferencesSection() {
  const t = useTranslations("notificationHistory");
  const preferencesQuery = useNotificationPreferencesQuery();

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">{t("preferences.heading")}</h2>
      <p className="mt-1 text-xs text-slate-500">{t("preferences.description")}</p>

      {preferencesQuery.isLoading && (
        <div className="mt-2 flex flex-col gap-2">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-8 w-full" />
          ))}
        </div>
      )}

      {preferencesQuery.isError && (
        <Alert variant="destructive" className="mt-2 flex items-center justify-between">
          <span>{t("preferences.error")}</span>
          <Button variant="outline" size="sm" onClick={() => preferencesQuery.refetch()}>
            {t("preferences.retry")}
          </Button>
        </Alert>
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
 * `useUpdateNotificationPreferenceMutation` is called once per row, mirroring
 * `SlaPolicyRow`/`AutomationRuleRow`'s Rules-of-Hooks convention. */
function PreferenceRow({ preference }: { preference: NotificationPreferenceSummary }) {
  const t = useTranslations("notificationHistory");
  const mutation = useUpdateNotificationPreferenceMutation();

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
        <Badge variant={preference.inAppEnabled ? "success" : "secondary"}>
          {preference.inAppEnabled ? t("preferences.enabled") : t("preferences.disabled")}
        </Badge>
        <Button variant="outline" size="sm" disabled={mutation.isPending} onClick={toggle}>
          {preference.inAppEnabled ? t("preferences.disable") : t("preferences.enable")}
        </Button>
      </div>
      {mutation.isError && (
        <p className="mt-1 text-xs text-red-600">
          {mutation.error instanceof ApiError
            ? mutation.error.message
            : t("preferences.actionFailed")}
        </p>
      )}
    </li>
  );
}
