import { describe, expect, it, vi } from "vitest";
import { TaskRealtimeListener } from "./task-realtime.listener";
import { TASK_REMINDER_DUE_EVENT } from "../modules/tasks/tasks.events";
import type { RealtimeGateway } from "./realtime.gateway";

function buildGatewayMock() {
  const emit = vi.fn();
  const to = vi.fn().mockReturnValue({ emit });
  return { server: { to }, _emit: emit, _to: to };
}

function createListener(gatewayMock: ReturnType<typeof buildGatewayMock>): TaskRealtimeListener {
  return new TaskRealtimeListener(gatewayMock as unknown as RealtimeGateway);
}

const reminderEvent = {
  taskId: "task-1",
  ownerUserId: "user-1",
  title: "Follow up with Acme Corp",
  dueAt: "2026-01-01T00:00:00.000Z",
};

describe("TaskRealtimeListener", () => {
  it("relays task.reminder_due into agent:{ownerUserId}:tasks with the unmodified event payload", () => {
    const gateway = buildGatewayMock();
    const listener = createListener(gateway);

    listener.onTaskReminderDue(reminderEvent);

    expect(gateway._to).toHaveBeenCalledWith("agent:user-1:tasks");
    expect(gateway._emit).toHaveBeenCalledWith(TASK_REMINDER_DUE_EVENT, reminderEvent);
  });

  it("does not throw when server.to(...).emit(...) throws — catches and logs instead", () => {
    const gateway = buildGatewayMock();
    gateway._to.mockImplementation(() => {
      throw new Error("socket server unavailable");
    });
    const listener = createListener(gateway);

    expect(() => listener.onTaskReminderDue(reminderEvent)).not.toThrow();
  });
});
