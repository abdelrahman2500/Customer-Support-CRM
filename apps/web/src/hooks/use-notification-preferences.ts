import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listNotificationPreferences,
  updateNotificationPreference,
} from "@/lib/notification-preferences-api";
import type { UpdateNotificationPreferenceInput } from "@/lib/notification-preferences-api";

/**
 * Story 58 — dedicated notification-preferences hooks, mirroring
 * `use-notifications.ts`'s own file/convention but for the caller's own,
 * self-scoped preferences (never branch-wide data, so no invalidation of
 * any other query is ever needed here).
 */
export const notificationPreferencesQueryKey = ["notification-preferences"] as const;

export function useNotificationPreferencesQuery() {
  return useQuery({
    queryKey: notificationPreferencesQueryKey,
    queryFn: listNotificationPreferences,
  });
}

export function useUpdateNotificationPreferenceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateNotificationPreferenceInput) => updateNotificationPreference(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationPreferencesQueryKey });
    },
  });
}
