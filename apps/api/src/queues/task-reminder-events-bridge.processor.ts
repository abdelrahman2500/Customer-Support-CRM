import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { Job } from "bullmq";
import { TASK_REMINDER_DUE_EVENT } from "../modules/tasks/tasks.events";
import type { TaskReminderDueEvent } from "../modules/tasks/tasks.events";

/**
 * The dedicated worker-to-api task-reminder hand-back queue —
 * apps/worker's `TaskReminderProcessor`
 * (apps/worker/src/queues/task-reminder.processor.ts) is this queue's
 * producer and duplicates this literal with a cross-reference comment,
 * the same convention Story 14/15 established. Not a generic event bus —
 * this queue carries only due-task-reminder results.
 */
export const TASK_REMINDER_EVENTS_QUEUE = "task-reminder-events";

/** The only shape a job on `TASK_REMINDER_EVENTS_QUEUE` ever takes.
 * `dueAt` is an ISO string here (BullMQ job data is JSON); the
 * `TaskReminderDueEvent` this processor emits carries the same string
 * verbatim — unlike `SlaDetectionJobPayload`, no `Date` reconstruction is
 * needed since nothing downstream does date arithmetic on it. */
export interface TaskReminderJobPayload {
  taskId: string;
  ownerUserId: string;
  title: string;
  dueAt: string;
}

/**
 * RM-03 — mirrors `SlaTimerEventsBridgeProcessor` exactly: translates one
 * typed job into exactly one `EventEmitter2.emit(...)` call. No
 * notification/business behavior of its own — `TaskRealtimeListener` is
 * the only current reactor to `task.reminder_due`.
 */
@Injectable()
@Processor(TASK_REMINDER_EVENTS_QUEUE)
export class TaskReminderEventsBridgeProcessor extends WorkerHost {
  private readonly logger = new Logger(TaskReminderEventsBridgeProcessor.name);

  constructor(private readonly eventEmitter: EventEmitter2) {
    super();
  }

  async process(job: Job<TaskReminderJobPayload>): Promise<void> {
    const payload: TaskReminderDueEvent = {
      taskId: job.data.taskId,
      ownerUserId: job.data.ownerUserId,
      title: job.data.title,
      dueAt: job.data.dueAt,
    };
    this.eventEmitter.emit(TASK_REMINDER_DUE_EVENT, payload);
    this.logger.log(`Emitted ${TASK_REMINDER_DUE_EVENT} for task ${job.data.taskId}`);
  }
}
