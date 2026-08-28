import { useQuery } from "@tanstack/react-query";
import { listNotifications } from "@/lib/notifications-api";

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
