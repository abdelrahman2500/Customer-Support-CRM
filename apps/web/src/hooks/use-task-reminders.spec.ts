import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { io } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { useTaskReminders } from "./use-task-reminders";

vi.mock("@/lib/api", () => ({
  getAccessToken: vi.fn(() => "test-token"),
  getSocketBaseUrl: () => "http://localhost:3001",
}));

vi.mock("socket.io-client", () => ({ io: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: vi.fn() }));
vi.mock("./use-tasks", () => ({ tasksQueryKey: ["tasks"] }));

function buildSocketMock() {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  return {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers.set(event, handler);
    }),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    _trigger: (event: string, ...args: unknown[]) => handlers.get(event)?.(...args),
  };
}

function buildQueryClientMock() {
  return { invalidateQueries: vi.fn() };
}

describe("useTaskReminders", () => {
  let queryClient: ReturnType<typeof buildQueryClientMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = buildQueryClientMock();
    vi.mocked(useQueryClient).mockReturnValue(queryClient as never);
  });

  it("does not connect when there is no userId", () => {
    renderHook(() => useTaskReminders(null));

    expect(io).not.toHaveBeenCalled();
  });

  it("joins agent:{userId}:tasks once connected", () => {
    const socket = buildSocketMock();
    vi.mocked(io).mockReturnValue(socket as never);

    renderHook(() => useTaskReminders("user-1"));

    expect(io).toHaveBeenCalledWith("http://localhost:3001", {
      auth: { token: "test-token" },
      transports: ["websocket"],
    });
    socket._trigger("connect");
    expect(socket.emit).toHaveBeenCalledWith("join", { room: "agent:user-1:tasks" });
  });

  it("invalidates the tasks query cache when task.reminder_due is received", () => {
    const socket = buildSocketMock();
    vi.mocked(io).mockReturnValue(socket as never);

    renderHook(() => useTaskReminders("user-1"));
    socket._trigger("task.reminder_due", { taskId: "task-1", ownerUserId: "user-1" });

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["tasks"] });
  });

  it("disconnects on unmount", () => {
    const socket = buildSocketMock();
    vi.mocked(io).mockReturnValue(socket as never);

    const { unmount } = renderHook(() => useTaskReminders("user-1"));
    unmount();

    expect(socket.disconnect).toHaveBeenCalledOnce();
  });

  it("reconnects when userId changes", () => {
    const socket = buildSocketMock();
    vi.mocked(io).mockReturnValue(socket as never);

    const { rerender } = renderHook(({ userId }) => useTaskReminders(userId), {
      initialProps: { userId: "user-1" },
    });
    rerender({ userId: "user-2" });

    expect(socket.disconnect).toHaveBeenCalledOnce();
    expect(io).toHaveBeenCalledTimes(2);
  });
});
