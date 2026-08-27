import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { io } from "socket.io-client";
import { useBranchNotifications } from "./use-branch-notifications";
import { getAccessToken } from "@/lib/api";
import type { BranchNotificationEventType, BranchNotificationPayload } from "@/lib/notifications-store";

type OnEventMock = ((eventType: BranchNotificationEventType, payload: BranchNotificationPayload) => void) &
  ReturnType<typeof vi.fn>;

vi.mock("@/lib/api", () => ({
  getAccessToken: vi.fn(() => "test-token"),
  getSocketBaseUrl: () => "http://localhost:3001",
}));

vi.mock("socket.io-client", () => ({ io: vi.fn() }));

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

describe("useBranchNotifications", () => {
  let socket: ReturnType<typeof buildSocketMock>;
  let onEvent: OnEventMock;

  beforeEach(() => {
    vi.clearAllMocks();
    socket = buildSocketMock();
    vi.mocked(io).mockReturnValue(socket as never);
    onEvent = vi.fn() as OnEventMock;
  });

  it("connects using the existing access-token mechanism", () => {
    renderHook(() => useBranchNotifications("branch-1", onEvent));

    expect(io).toHaveBeenCalledWith("http://localhost:3001", {
      auth: { token: "test-token" },
      transports: ["websocket"],
    });
  });

  it("joins branch:{id}:notifications once connected — never ticket:{id}", () => {
    renderHook(() => useBranchNotifications("branch-1", onEvent));

    socket._trigger("connect");

    expect(socket.emit).toHaveBeenCalledWith("join", { room: "branch:branch-1:notifications" });
    expect(socket.emit).not.toHaveBeenCalledWith("join", expect.objectContaining({ room: expect.stringContaining("ticket:") }));
  });

  it("forwards sla.at_risk to onEvent with the unmodified payload", () => {
    renderHook(() => useBranchNotifications("branch-1", onEvent));
    const payload = { ticketId: "t1", branchId: "branch-1", targetType: "response", targetAt: "2024-01-01" };

    socket._trigger("sla.at_risk", payload);

    expect(onEvent).toHaveBeenCalledWith("sla.at_risk", payload);
  });

  it("forwards sla.breached to onEvent with the unmodified payload", () => {
    renderHook(() => useBranchNotifications("branch-1", onEvent));
    const payload = { ticketId: "t1", branchId: "branch-1", targetType: "resolution", targetAt: "2024-01-01" };

    socket._trigger("sla.breached", payload);

    expect(onEvent).toHaveBeenCalledWith("sla.breached", payload);
  });

  it("forwards ticket.escalated to onEvent with the unmodified payload", () => {
    renderHook(() => useBranchNotifications("branch-1", onEvent));
    const payload = { ticket: { id: "t1", subject: "Cannot log in" }, actorUserId: null };

    socket._trigger("ticket.escalated", payload);

    expect(onEvent).toHaveBeenCalledWith("ticket.escalated", payload);
  });

  it("does not connect when branchId is null", () => {
    renderHook(() => useBranchNotifications(null, onEvent));

    expect(io).not.toHaveBeenCalled();
  });

  it("does not connect when there is no access token", () => {
    vi.mocked(getAccessToken).mockReturnValueOnce(null);

    renderHook(() => useBranchNotifications("branch-1", onEvent));

    expect(io).not.toHaveBeenCalled();
  });

  it("disconnects and removes listeners on unmount", () => {
    const { unmount } = renderHook(() => useBranchNotifications("branch-1", onEvent));

    unmount();

    expect(socket.off).toHaveBeenCalledWith("sla.at_risk", expect.any(Function));
    expect(socket.off).toHaveBeenCalledWith("sla.breached", expect.any(Function));
    expect(socket.off).toHaveBeenCalledWith("ticket.escalated", expect.any(Function));
    expect(socket.disconnect).toHaveBeenCalledOnce();
  });

  it("does not open a second connection when only the onEvent callback identity changes across re-renders", () => {
    const { rerender } = renderHook(({ cb }: { cb: OnEventMock }) => useBranchNotifications("branch-1", cb), {
      initialProps: { cb: vi.fn() as OnEventMock },
    });

    expect(io).toHaveBeenCalledOnce();

    // A fresh inline callback, as a parent re-render would produce.
    rerender({ cb: vi.fn() as OnEventMock });

    expect(io).toHaveBeenCalledOnce();
  });

  it("still delivers events to the latest onEvent after a callback-identity-only re-render", () => {
    const first = vi.fn() as OnEventMock;
    const second = vi.fn() as OnEventMock;
    const { rerender } = renderHook(({ cb }: { cb: OnEventMock }) => useBranchNotifications("branch-1", cb), {
      initialProps: { cb: first },
    });

    rerender({ cb: second });
    socket._trigger("ticket.escalated", { ticket: { id: "t1", subject: "x" }, actorUserId: null });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });

  it("re-establishes the connection when branchId changes", () => {
    const { rerender } = renderHook(({ id }) => useBranchNotifications(id, onEvent), {
      initialProps: { id: "branch-1" },
    });
    expect(io).toHaveBeenCalledTimes(1);

    rerender({ id: "branch-2" });

    expect(socket.disconnect).toHaveBeenCalledOnce();
    expect(io).toHaveBeenCalledTimes(2);
  });
});
