"use client";

import { useCallback } from "react";
import { usePortalNotifications } from "@/hooks/use-portal-notifications";
import { usePortalNotificationPreferencesQuery } from "@/hooks/use-portal-notification-preferences";
import { usePortalNotificationsStore } from "@/lib/notifications-store";
import type {
  PortalNotificationEventType,
  PortalNotificationPayload,
} from "@/lib/notifications-store";
import { NotificationToaster } from "./notification-toaster";

/**
 * Story 86 — the single mount point for the Customer Portal's
 * `customer:{customerId}:notifications` consumer, mirroring
 * `apps/web`'s `BranchNotifications`. Rendered once from
 * `(customer)/layout.tsx` (never from a per-ticket page), so the
 * connection is established exactly once per authenticated session,
 * independent of which portal page is active.
 *
 * Story 90 — a client-side filter only (mirrors `BranchNotifications`'s own
 * Story 58 addition exactly): the `customer:{customerId}:notifications`
 * broadcast itself is unchanged (still every event, no per-recipient
 * resolution). While the preferences query is still loading or has failed,
 * every event type is treated as enabled — a transient fetch hiccup must
 * never silently suppress a real toast.
 */
export function PortalNotifications({ customerId }: { customerId: string }) {
  const add = usePortalNotificationsStore((state) => state.add);
  const preferencesQuery = usePortalNotificationPreferencesQuery();

  const handleEvent = useCallback(
    (eventType: PortalNotificationEventType, payload: PortalNotificationPayload) => {
      const preference = preferencesQuery.data?.find((row) => row.eventType === eventType);
      if (preference && !preference.inAppEnabled) {
        return;
      }
      add(eventType, payload);
    },
    [add, preferencesQuery.data],
  );

  usePortalNotifications(customerId, handleEvent);
  return <NotificationToaster />;
}
