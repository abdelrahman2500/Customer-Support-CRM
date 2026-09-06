import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { RealtimeGateway } from "./realtime.gateway";
import { TASK_REMINDER_DUE_EVENT } from "../modules/tasks/tasks.events";
import type { TaskReminderDueEvent } from "../modules/tasks/tasks.events";

/**
 * RM-03 — relays `task.reminder_due` (emitted by
 * `TaskReminderEventsBridgeProcessor` once `apps/worker`'s
 * `TaskReminderProcessor` claims a due reminder) into
 * `agent:{ownerUserId}:tasks` — a room only that one agent can ever join
 * (`RealtimeGateway.authorizeRoom`'s own `agent:(.+):tasks` case, own-id
 * only, no branch-membership fallback: unlike presence, nobody else has
 * any legitimate reason to watch another agent's personal tasks).
 * Structurally mirrors `BranchNotificationRealtimeListener`: one
 * `@OnEvent` handler, a synchronous `relay()`, try/catch, `Logger.error`
 * on failure, never rethrows.
 */
@Injectable()
export class TaskRealtimeListener {
  private readonly logger = new Logger(TaskRealtimeListener.name);

  constructor(private readonly gateway: RealtimeGateway) {}

  @OnEvent(TASK_REMINDER_DUE_EVENT)
  onTaskReminderDue(event: TaskReminderDueEvent): void {
    try {
      this.gateway.server.to(`agent:${event.ownerUserId}:tasks`).emit(TASK_REMINDER_DUE_EVENT, event);
    } catch (error) {
      this.logger.error(`Failed to relay ${TASK_REMINDER_DUE_EVENT} for task ${event.taskId}`, error as Error);
    }
  }
}
