"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import {
  usePortalNotificationPreferencesQuery,
  useUpdatePortalNotificationPreferenceMutation,
} from "@/hooks/use-portal-notification-preferences";
import type { PortalNotificationPreferenceSummary } from "@/lib/notification-preferences-api";
import { useErrorMessage } from "@/hooks/use-error-message";
import { Alert, Button, Label, LoadingStatus, SectionCard, Skeleton, Switch } from "@crm/ui";

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
 * exactly. It was written in plain Tailwind because no shared UI package
 * existed for `apps/portal` then — Story S-2 extracted `@crm/ui` and Story
 * 135 migrated this app onto it, so the section now builds on `Alert`,
 * `Button`, `Card` and `Skeleton` from that package instead.
 */
export function NotificationPreferencesSection() {
  const t = useTranslations("notifications");
  const tCommon = useTranslations("common");
  const preferencesQuery = usePortalNotificationPreferencesQuery();

  return (
    <SectionCard title={t("preferences.heading")}>
      <p className="mt-1 text-xs text-ink-subtle">{t("preferences.description")}</p>

      {preferencesQuery.isLoading && (
        <LoadingStatus label={tCommon("loading")} className="mt-2 flex flex-col gap-2">
          {[0, 1].map((row) => (
            <Skeleton key={row} className="h-8 w-full" />
          ))}
        </LoadingStatus>
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
        <ul className="mt-2 flex flex-col divide-y divide-rule-subtle">
          {preferencesQuery.data.map((preference) => (
            <PreferenceRow key={preference.eventType} preference={preference} />
          ))}
        </ul>
      )}
    </SectionCard>
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
  const switchId = useId();

  function toggle() {
    mutation.mutate({
      eventType: preference.eventType,
      inAppEnabled: !preference.inAppEnabled,
    });
  }

  // Story 231 (PR-5.3) — the shared `Switch` (role="switch", named by its
  // label) replaces the status pill plus "Enable"/"Disable" button pair:
  // one control that both shows and changes the preference.
  return (
    <li className="flex flex-col gap-1 py-3 text-sm">
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor={switchId} className="font-normal text-ink-strong">
          {labelKey ? t(labelKey) : preference.eventType}
        </Label>
        <Switch
          id={switchId}
          checked={preference.inAppEnabled}
          onCheckedChange={toggle}
          disabled={mutation.isPending}
        />
      </div>
      {mutation.isError && (
        <p className="mt-1 text-xs text-danger-foreground">
          {errorMessage(mutation.error, {
            forbidden: t("preferences.actionForbidden"),
            generic: t("preferences.actionFailed"),
          })}
        </p>
      )}
    </li>
  );
}
