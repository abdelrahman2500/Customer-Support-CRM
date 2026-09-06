import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import type { Job, Queue } from "bullmq";

vi.mock("@sentry/node", () => ({ captureException: vi.fn() }));

// Imported after the mock so the mocked module is what the processor sees.
import * as Sentry from "@sentry/node";
import { TASK_REMINDERS_QUEUE, TaskReminderProcessor } from "./task-reminder.processor";

function buildPrismaMock() {
  return {
    task: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  };
}

function buildHandbackQueueMock() {
  return {
    add: vi.fn(),
  };
}

function createProcessor(
  prismaMock: ReturnType<typeof buildPrismaMock>,
  queueMock: ReturnType<typeof buildHandbackQueueMock>,
): TaskReminderProcessor {
  return new TaskReminderProcessor(prismaMock as unknown as PrismaService, queueMock as unknown as Queue);
}

function candidateRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "task-1",
    ownerUserId: "user-1",
    title: "Follow up with Acme Corp",
    dueAt: new Date("2026-01-01T10:00:00.000Z"),
    ...overrides,
  };
}

describe("TaskReminderProcessor", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let handbackQueue: ReturnType<typeof buildHandbackQueueMock>;
  let processor: TaskReminderProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
    handbackQueue = buildHandbackQueueMock();
    processor = createProcessor(prisma, handbackQueue);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T11:00:00.000Z")); // after the candidate's dueAt
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("process", () => {
    it("queries candidates scoped to due, not-yet-reminded, not-yet-completed tasks", async () => {
      prisma.task.findMany.mockResolvedValue([]);

      await processor.process({} as never);

      expect(prisma.task.findMany).toHaveBeenCalledWith({
        where: {
          dueAt: { lte: new Date("2026-01-01T11:00:00.000Z") },
          reminderSentAt: null,
          completedAt: null,
        },
        select: { id: true, ownerUserId: true, title: true, dueAt: true },
      });
    });

    it("claims and enqueues exactly one hand-back job for a due task", async () => {
      prisma.task.findMany.mockResolvedValue([candidateRow()]);
      prisma.task.updateMany.mockResolvedValue({ count: 1 });

      await processor.process({} as never);

      expect(prisma.task.updateMany).toHaveBeenCalledWith({
        where: { id: "task-1", reminderSentAt: null },
        data: { reminderSentAt: new Date("2026-01-01T11:00:00.000Z") },
      });
      expect(handbackQueue.add).toHaveBeenCalledWith("task-reminder", {
        taskId: "task-1",
        ownerUserId: "user-1",
        title: "Follow up with Acme Corp",
        dueAt: "2026-01-01T10:00:00.000Z",
      });
    });

    it("does not enqueue when the conditional update loses the race (count 0)", async () => {
      prisma.task.findMany.mockResolvedValue([candidateRow()]);
      prisma.task.updateMany.mockResolvedValue({ count: 0 });

      await processor.process({} as never);

      expect(handbackQueue.add).not.toHaveBeenCalled();
    });

    it("processes multiple due tasks independently", async () => {
      prisma.task.findMany.mockResolvedValue([
        candidateRow({ id: "task-1" }),
        candidateRow({ id: "task-2", ownerUserId: "user-2", title: "Call back the customer" }),
      ]);
      prisma.task.updateMany.mockResolvedValue({ count: 1 });

      await processor.process({} as never);

      expect(prisma.task.updateMany).toHaveBeenCalledTimes(2);
      expect(handbackQueue.add).toHaveBeenCalledTimes(2);
    });
  });

  describe("onFailed", () => {
    it("reports a failed job's error to Sentry, tagged with the queue and job id", () => {
      const error = new Error("Prisma connection lost");
      const job = { id: "job-7" } as Job;

      processor.onFailed(job, error);

      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        tags: { queue: TASK_REMINDERS_QUEUE, jobId: "job-7" },
      });
    });

    it("tolerates an undefined job (BullMQ's own documented stalled-job case)", () => {
      const error = new Error("stalled");

      processor.onFailed(undefined, error);

      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        tags: { queue: TASK_REMINDERS_QUEUE, jobId: undefined },
      });
    });
  });
});
