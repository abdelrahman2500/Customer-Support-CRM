import { describe, expect, it, vi } from "vitest";
import { TaskReminderEventsBridgeProcessor } from "./task-reminder-events-bridge.processor";
import type { TaskReminderJobPayload } from "./task-reminder-events-bridge.processor";
import { TASK_REMINDER_DUE_EVENT } from "../modules/tasks/tasks.events";
import type { EventEmitter2 } from "@nestjs/event-emitter";
import type { Job } from "bullmq";

function buildEventEmitterMock() {
  return {
    emit: vi.fn(),
  };
}

function createProcessor(
  emitterMock: ReturnType<typeof buildEventEmitterMock>,
): TaskReminderEventsBridgeProcessor {
  return new TaskReminderEventsBridgeProcessor(emitterMock as unknown as EventEmitter2);
}

function buildJob(data: TaskReminderJobPayload): Job<TaskReminderJobPayload> {
  return { data } as Job<TaskReminderJobPayload>;
}

describe("TaskReminderEventsBridgeProcessor", () => {
  it("emits task.reminder_due with the job's payload", async () => {
    const emitter = buildEventEmitterMock();
    const processor = createProcessor(emitter);
    const job = buildJob({
      taskId: "task-1",
      ownerUserId: "user-1",
      title: "Follow up with Acme Corp",
      dueAt: "2026-01-01T00:00:00.000Z",
    });

    await processor.process(job);

    expect(emitter.emit).toHaveBeenCalledOnce();
    expect(emitter.emit).toHaveBeenCalledWith(TASK_REMINDER_DUE_EVENT, {
      taskId: "task-1",
      ownerUserId: "user-1",
      title: "Follow up with Acme Corp",
      dueAt: "2026-01-01T00:00:00.000Z",
    });
  });
});
