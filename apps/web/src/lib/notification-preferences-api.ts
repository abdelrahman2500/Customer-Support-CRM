import { apiFetch } from "./api";

/**
 * Story 58 — Notifications — Per-User In-App Preferences. A dedicated API
 * client file, mirroring `notifications-api.ts`'s own "distinct domain,
 * own file" convention.
 *
 * Mirrors the backend's own `NotificationPreferenceSummary`
 * (`apps/api/src/modules/notifications/notification-preferences.service.ts`)
 * exactly.
 */
export interface NotificationPreferenceSummary {
  eventType: string;
  inAppEnabled: boolean;
}

export interface UpdateNotificationPreferenceInput {
  eventType: string;
  inAppEnabled: boolean;
}

export function listNotificationPreferences(): Promise<NotificationPreferenceSummary[]> {
  return apiFetch<NotificationPreferenceSummary[]>("/notification-preferences");
}

export function updateNotificationPreference(
  input: UpdateNotificationPreferenceInput,
): Promise<NotificationPreferenceSummary> {
  return apiFetch<NotificationPreferenceSummary>("/notification-preferences", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
