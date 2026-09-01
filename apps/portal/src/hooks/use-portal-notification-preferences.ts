import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listMyNotificationPreferences,
  updateMyNotificationPreference,
} from "@/lib/notification-preferences-api";
import type { UpdatePortalNotificationPreferenceInput } from "@/lib/notification-preferences-api";

/**
 * Story 90 — dedicated notification-preferences hooks, mirroring
 * `apps/web/src/hooks/use-notification-preferences.ts`'s own file/
 * convention but for the caller's own, self-scoped Contact preferences
 * (never another contact's or an agent's data, so no invalidation of any
 * other query is ever needed here).
 */
export const portalNotificationPreferencesQueryKey = ["portal-notification-preferences"] as const;

export function usePortalNotificationPreferencesQuery() {
  return useQuery({
    queryKey: portalNotificationPreferencesQueryKey,
    queryFn: listMyNotificationPreferences,
  });
}

export function useUpdatePortalNotificationPreferenceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePortalNotificationPreferenceInput) =>
      updateMyNotificationPreference(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: portalNotificationPreferencesQueryKey });
    },
  });
}
