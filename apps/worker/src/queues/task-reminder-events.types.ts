/**
 * Must stay identical to the corresponding declarations in
 * apps/api/src/queues/task-reminder-events-bridge.processor.ts — no
 * cross-app shared-constants/types mechanism exists in this repository
 * (see Story 14's precedent for `HEALTH_CHECK_QUEUE`), so these are
 * deliberately duplicated, not imported.
 */
export const TASK_REMINDER_EVENTS_QUEUE = "task-reminder-events";

export interface TaskReminderJobPayload {
  taskId: string;
  ownerUserId: string;
  title: string;
  dueAt: string;
}
