import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getUnreadNotificationCount,
  listNotifications,
  markNotificationsRead,
} from "@/lib/notifications-api";

/**
 * Story 39 — dedicated notification-history hook (mirroring
 * `use-sla-policies.ts`/`use-roles.ts`/`use-business-hours.ts`'s "own file,
 * no import from `use-tickets.ts`" convention). Read-only — no mutation
 * exists on this screen, so there is nothing to invalidate. No `staleTime`
 * override: unlike `useUsersQuery`/`useCustomersQuery`'s infrequently-
 * changing reference data, a notification history is a log that keeps
 * growing, so it re-fetches on every mount/window-focus like the default
 * `useTicketsQuery`.
 */
export const notificationsQueryKey = ["notifications"] as const;

export function useNotificationsQuery() {
  return useQuery({ queryKey: notificationsQueryKey, queryFn: listNotifications });
}

/**
 * Story 92 — a dedicated, independent query key from `notificationsQueryKey`:
 * the count is consumed from `WorkspaceNav` (mounted everywhere) as well as
 * `NotificationHistoryView`, so it must not be coupled to the history list's
 * own fetch lifecycle.
 */
export const unreadNotificationCountQueryKey = ["notifications", "unread-count"] as const;

export function useUnreadNotificationCountQuery() {
  return useQuery({
    queryKey: unreadNotificationCountQueryKey,
    queryFn: getUnreadNotificationCount,
  });
}

/**
 * Story 92 — invalidates the unread-count query on success so
 * `WorkspaceNav`'s badge reflects the new (zero) count immediately, the
 * same invalidate-on-success shape `use-notification-preferences.ts`'s own
 * mutation already established.
 */
export function useMarkNotificationsReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: unreadNotificationCountQueryKey });
    },
  });
}
