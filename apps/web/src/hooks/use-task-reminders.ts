"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getAccessToken } from "@/lib/api";
import {
  acquireSharedSocket,
  joinRoomOnConnect,
  releaseSharedSocket,
} from "@/lib/realtime-connection";
import { tasksQueryKey } from "./use-tasks";

const TASK_REMINDER_DUE_EVENT = "task.reminder_due";

/**
 * RM-03 — mirrors `useTicketRealtime`'s architecture: owns `useQueryClient()`
 * itself and invalidates the tasks cache directly on the event, rather than
 * exposing an `onEvent` callback for the caller to build (`useBranchNotifications`'s
 * shape) — there is exactly one thing to do with this event (refresh the
 * task list), so there is nothing for a caller-supplied callback to add.
 * Joins the caller's own `agent:{userId}:tasks` room
 * (`RealtimeGateway.authorizeRoom`'s own `agent:(.+):tasks` case — own id
 * only, no branch-membership fallback: a task reminder is strictly
 * personal). Connects on mount, disconnects on unmount/id change.
 *
 * Batch 7 (UX audit) — acquires the shared, pooled socket connection
 * (`realtime-connection.ts`) instead of opening its own.
 */
export function useTaskReminders(userId: string | null): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId || !getAccessToken()) {
      return;
    }

    const socket = acquireSharedSocket();
    const unjoin = joinRoomOnConnect(socket, `agent:${userId}:tasks`);

    const handleReminderDue = () => {
      void queryClient.invalidateQueries({ queryKey: tasksQueryKey });
    };
    socket.on(TASK_REMINDER_DUE_EVENT, handleReminderDue);

    return () => {
      unjoin();
      socket.off(TASK_REMINDER_DUE_EVENT, handleReminderDue);
      releaseSharedSocket();
    };
  }, [userId, queryClient]);
}
