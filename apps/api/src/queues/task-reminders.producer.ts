import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";

/**
 * Must stay identical to `TASK_REMINDERS_QUEUE` in
 * apps/worker/src/queues/task-reminder.processor.ts — no cross-app
 * shared-constants mechanism exists in this repository (Story 14's own
 * precedent for `HEALTH_CHECK_QUEUE`), so this is a deliberately
 * duplicated literal, not an import.
 */
export const TASK_REMINDERS_QUEUE = "task-reminders";

const TASK_REMINDER_SCHEDULER_ID = "task-reminders-scheduler";
const TASK_REMINDER_INTERVAL_MS = 60_000;

/**
 * RM-03 — mirrors `SlaTimersProducer` exactly: registers the recurring
 * `task-reminders` scheduler on module init via BullMQ's current Job
 * Scheduler API (`upsertJobScheduler`), which is idempotent by
 * construction (calling it again with the same scheduler id and repeat
 * options updates the existing scheduler rather than creating a second
 * one) — no additional duplicate-prevention logic needed here. Same
 * 60-second interval as `sla-timers`, no need to invent a different
 * cadence.
 */
@Injectable()
export class TaskRemindersProducer implements OnModuleInit {
  private readonly logger = new Logger(TaskRemindersProducer.name);

  constructor(@InjectQueue(TASK_REMINDERS_QUEUE) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      TASK_REMINDER_SCHEDULER_ID,
      { every: TASK_REMINDER_INTERVAL_MS },
      { name: "check" },
    );
    this.logger.log(`Registered task-reminders scheduler (every ${TASK_REMINDER_INTERVAL_MS}ms)`);
  }
}
