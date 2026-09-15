"use client";

import { useCallback, useMemo } from "react";
import { useBranchNotifications } from "@/hooks/use-branch-notifications";
import { useNotificationPreferencesQuery } from "@/hooks/use-notification-preferences";
import { useNotificationTemplatesQuery } from "@/hooks/use-notification-templates";
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
 *
 * Story 63 — `useNotificationTemplatesQuery()` fetched here too, the same
 * independent-query pattern preferences already established: while loading
 * or erroring, `templateByEventType` is simply empty, and every toast falls
 * back to its default message (never blocking rendering).
 */
export function BranchNotifications({ branchId }: { branchId: string | null }) {
  const add = useNotificationsStore((state) => state.add);
  const preferencesQuery = useNotificationPreferencesQuery();
  const templatesQuery = useNotificationTemplatesQuery();

  // Story 131 — an inactive template is skipped here, while the map is
  // being built, so it never reaches `NotificationToaster` at all. That
  // component already treats a missing entry as "no custom template" and
  // renders its own built-in message (`messageFor`'s `if (template)`
  // guard), so it needs no change of its own: omitting the entry is the
  // whole fix, and there is no second copy of the rule to drift.
  const templateByEventType = useMemo(() => {
    const map = new Map<string, string>();
    for (const template of templatesQuery.data ?? []) {
      if (!template.isActive) {
        continue;
      }
      map.set(template.eventType, template.template);
    }
    return map;
  }, [templatesQuery.data]);

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
  return <NotificationToaster templateByEventType={templateByEventType} />;
}
