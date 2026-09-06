/**
 * RM-03 — mirrors `../ai/ai.events.ts`'s exact shape/placement: the
 * in-process `EventEmitter2` domain event `TaskReminderEventsBridgeProcessor`
 * emits once `apps/worker` hands a due reminder back. Only
 * `TaskRealtimeListener` reacts to this — relayed verbatim into
 * `agent:{ownerUserId}:tasks`, a room only that one agent can ever join
 * (see `RealtimeGateway.authorizeRoom`'s own `agent:(.+):tasks` case).
 */
export const TASK_REMINDER_DUE_EVENT = "task.reminder_due";

/** Never the task's `notes` — this is enough for an already-authorized
 * client watching its own `agent:{userId}:tasks` room to know a reminder
 * fired and refresh its task list; the durable `Task` row (via `GET
 * /tasks`) remains the source of truth. */
export interface TaskReminderDueEvent {
  taskId: string;
  ownerUserId: string;
  title: string;
  dueAt: string;
}
