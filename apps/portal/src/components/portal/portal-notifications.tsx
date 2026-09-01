"use client";

import { useCallback } from "react";
import { usePortalNotifications } from "@/hooks/use-portal-notifications";
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
 */
export function PortalNotifications({ customerId }: { customerId: string }) {
  const add = usePortalNotificationsStore((state) => state.add);

  const handleEvent = useCallback(
    (eventType: PortalNotificationEventType, payload: PortalNotificationPayload) => {
      add(eventType, payload);
    },
    [add],
  );

  usePortalNotifications(customerId, handleEvent);
  return <NotificationToaster />;
}
