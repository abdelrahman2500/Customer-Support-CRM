import { useQuery } from "@tanstack/react-query";
import { listMyNotifications } from "@/lib/notifications-api";

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
