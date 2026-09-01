import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getUnreadNotificationCount,
  listMyNotifications,
  markNotificationsRead,
} from "@/lib/notifications-api";

/**
 * Story 89 — dedicated notification-history hook, distinct from
 * `use-portal-notifications.ts` (Story 86's realtime Socket.IO hook —
 * same name prefix, different concern; that file is not touched by this
 * story). Mirrors `apps/web/src/hooks/use-notifications.ts`'s own
 * "own file, no `staleTime` override" convention exactly: read-only, no
 * mutation exists on this screen, and a notification history is a log
 * that keeps growing, so it re-fetches on every mount/window-focus like
 * the default `useMyTicketsQuery`.
 */
export const myNotificationsQueryKey = ["portal-notifications"] as const;

export function useMyNotificationsQuery() {
  return useQuery({ queryKey: myNotificationsQueryKey, queryFn: listMyNotifications });
}

/**
 * Story 92 — a dedicated, independent query key from `myNotificationsQueryKey`:
 * the count is consumed from `PortalHeader` (mounted everywhere) as well as
 * `NotificationHistoryView`, so it must not be coupled to the history
 * list's own fetch lifecycle. Mirrors `apps/web`'s
 * `unreadNotificationCountQueryKey`/`useUnreadNotificationCountQuery`.
 */
export const unreadNotificationCountQueryKey = ["portal-notifications", "unread-count"] as const;

export function useUnreadNotificationCountQuery() {
  return useQuery({
    queryKey: unreadNotificationCountQueryKey,
    queryFn: getUnreadNotificationCount,
  });
}

/**
 * Story 92 — invalidates the unread-count query on success so
 * `PortalHeader`'s badge reflects the new (zero) count immediately.
 * Mirrors `apps/web`'s `useMarkNotificationsReadMutation`.
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
