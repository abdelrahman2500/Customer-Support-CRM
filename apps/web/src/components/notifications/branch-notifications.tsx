"use client";

import { useBranchNotifications } from "@/hooks/use-branch-notifications";
import { useNotificationsStore } from "@/lib/notifications-store";
import { NotificationToaster } from "./notification-toaster";

/**
 * Story 24 — the single mount point for the Agent Workspace's branch-wide
 * notification consumer. Rendered once from `(agent)/layout.tsx` (never
 * from `TicketListView`/`TicketDetailView`/individual pages), so the
 * `branch:{id}:notifications` connection is established exactly once per
 * authenticated session, independent of which workspace page is active.
 */
export function BranchNotifications({ branchId }: { branchId: string | null }) {
  const add = useNotificationsStore((state) => state.add);
  useBranchNotifications(branchId, add);
  return <NotificationToaster />;
}
