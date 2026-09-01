import { apiFetch } from "./api";

/**
 * Story 90 — Customer Portal: Notification Preferences. A dedicated API
 * client file, mirroring `apps/web/src/lib/notification-preferences-api.ts`'s
 * own "distinct domain, own file" convention (this directory's own
 * `notifications-api.ts`/`branding-api.ts`/`knowledge-base-api.ts`/
 * `chat-api.ts` precedent).
 *
 * Mirrors the backend's own `PortalNotificationPreferenceSummary`
 * (`apps/api/src/modules/notifications/portal-notification-preferences.service.ts`)
 * exactly.
 */
export interface PortalNotificationPreferenceSummary {
  eventType: string;
  inAppEnabled: boolean;
}

export interface UpdatePortalNotificationPreferenceInput {
  eventType: string;
  inAppEnabled: boolean;
}

export function listMyNotificationPreferences(): Promise<PortalNotificationPreferenceSummary[]> {
  return apiFetch<PortalNotificationPreferenceSummary[]>("/portal/notification-preferences");
}

export function updateMyNotificationPreference(
  input: UpdatePortalNotificationPreferenceInput,
): Promise<PortalNotificationPreferenceSummary> {
  return apiFetch<PortalNotificationPreferenceSummary>("/portal/notification-preferences", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
