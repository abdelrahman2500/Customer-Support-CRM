import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import type { Job, Queue } from "bullmq";
import * as Sentry from "@sentry/node";
import { PrismaService } from "../prisma/prisma.service";
import { TASK_REMINDER_EVENTS_QUEUE, type TaskReminderJobPayload } from "./task-reminder-events.types";

/**
 * Must stay identical to `TASK_REMINDERS_QUEUE` in
 * apps/api/src/queues/task-reminders.producer.ts.
 */
export const TASK_REMINDERS_QUEUE = "task-reminders";

/**
 * RM-03 — `apps/worker`'s half of the task-reminder sweep, mirroring
 * `SlaTimerProcessor` exactly. Never uses `TenantContext` (structurally
 * unavailable outside an HTTP request, same as every other worker
 * processor) — a global, cross-owner sweep is correct here, exactly like
 * `SlaTimerProcessor`'s own cross-branch sweep: `Task` carries no
 * `branchId` of its own (see that model's schema doc comment), so there
 * is nothing to scope this query by even if a request context existed.
 */
@Injectable()
@Processor(TASK_REMINDERS_QUEUE)
export class TaskReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(TaskReminderProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(TASK_REMINDER_EVENTS_QUEUE)
    private readonly handbackQueue: Queue<TaskReminderJobPayload>,
  ) {
    super();
  }

  async process(_job: Job): Promise<void> {
    const now = new Date();

    const candidates = await this.prisma.task.findMany({
      where: { dueAt: { lte: now }, reminderSentAt: null, completedAt: null },
      select: { id: true, ownerUserId: true, title: true, dueAt: true },
    });

    for (const task of candidates) {
      await this.claimAndFire(task, now);
    }
  }

  /**
   * Atomically claims the right to fire this task's one reminder via a
   * conditional `updateMany` (`where` includes `reminderSentAt: null`) —
   * mirrors `SlaTimerProcessor.claim`'s exact race-safe pattern: the
   * instant Postgres commits the update, `count` reports whether *this*
   * call actually changed the row, so two overlapping ticks (or two
   * worker instances) can never both enqueue a hand-back job for the same
   * reminder. The update is attempted before the hand-back job is
   * enqueued, not after — the same accepted, documented "never duplicate
   * over never lose" rare-failure gap `SlaTimerProcessor` already
   * accepts, not a new risk this story introduces.
   */
  private async claimAndFire(
    task: { id: string; ownerUserId: string; title: string; dueAt: Date | null },
    now: Date,
  ): Promise<void> {
    const claimed = await this.prisma.task.updateMany({
      where: { id: task.id, reminderSentAt: null },
      data: { reminderSentAt: now },
    });
    if (claimed.count === 0) {
      // Another concurrent/overlapping run already claimed it.
      return;
    }

    const payload: TaskReminderJobPayload = {
      taskId: task.id,
      ownerUserId: task.ownerUserId,
      title: task.title,
      dueAt: (task.dueAt ?? now).toISOString(),
    };
    await this.handbackQueue.add("task-reminder", payload);
    this.logger.log(`Fired task.reminder_due for task ${task.id}`);
  }

  /**
   * Mirrors `SlaTimerProcessor.onFailed` exactly: `process()` has no
   * try/catch, so a genuinely unhandled exception (e.g. a Prisma error)
   * propagates to BullMQ itself, which marks the job failed and emits
   * this event.
   */
  @OnWorkerEvent("failed")
  onFailed(job: Job | undefined, error: Error): void {
    Sentry.captureException(error, { tags: { queue: TASK_REMINDERS_QUEUE, jobId: job?.id } });
  }
}
