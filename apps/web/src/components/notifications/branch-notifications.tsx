"use client";

import { useCallback } from "react";
import { useBranchNotifications } from "@/hooks/use-branch-notifications";
import { useNotificationPreferencesQuery } from "@/hooks/use-notification-preferences";
import { useNotificationsStore } from "@/lib/notifications-store";
import type {
  BranchNotificationEventType,
  BranchNotificationPayload,
} from "@/lib/notifications-store";
import { NotificationToaster } from "./notification-toaster";

/**
 * Story 24 — the single mount point for the Agent Workspace's branch-wide
 * notification consumer. Rendered once from `(agent)/layout.tsx` (never
 * from `TicketListView`/`TicketDetailView`/individual pages), so the
 * `branch:{id}:notifications` connection is established exactly once per
 * authenticated session, independent of which workspace page is active.
 *
 * Story 58 — a client-side filter only (Design decision 4 of the plan): the
 * backend broadcast itself is unchanged (still branch-wide, no per-recipient
 * resolution). While the preferences query is still loading or has failed,
 * every event type is treated as enabled — a transient fetch hiccup must
 * never silently suppress a real toast.
 */
export function BranchNotifications({ branchId }: { branchId: string | null }) {
  const add = useNotificationsStore((state) => state.add);
  const preferencesQuery = useNotificationPreferencesQuery();

  const handleEvent = useCallback(
    (eventType: BranchNotificationEventType, payload: BranchNotificationPayload) => {
      const preference = preferencesQuery.data?.find((row) => row.eventType === eventType);
      if (preference && !preference.inAppEnabled) {
        return;
      }
      add(eventType, payload);
    },
    [add, preferencesQuery.data],
  );

  useBranchNotifications(branchId, handleEvent);
  return <NotificationToaster />;
}
