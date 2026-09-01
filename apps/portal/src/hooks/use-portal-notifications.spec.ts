import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { io } from "socket.io-client";
import { usePortalNotifications } from "./use-portal-notifications";
import { getAccessToken } from "@/lib/api";
import type {
  PortalNotificationEventType,
  PortalNotificationPayload,
} from "@/lib/notifications-store";

type OnEventMock = ((
  eventType: PortalNotificationEventType,
  payload: PortalNotificationPayload,
) => void) &
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

describe("usePortalNotifications", () => {
  let socket: ReturnType<typeof buildSocketMock>;
  let onEvent: OnEventMock;

  beforeEach(() => {
    vi.clearAllMocks();
    socket = buildSocketMock();
    vi.mocked(io).mockReturnValue(socket as never);
    onEvent = vi.fn() as OnEventMock;
  });

  it("connects using the existing access-token mechanism", () => {
    renderHook(() => usePortalNotifications("customer-1", onEvent));

    expect(io).toHaveBeenCalledWith("http://localhost:3001", {
      auth: { token: "test-token" },
      transports: ["websocket"],
    });
  });

  it("joins customer:{id}:notifications once connected — never ticket:{id}", () => {
    renderHook(() => usePortalNotifications("customer-1", onEvent));

    socket._trigger("connect");

    expect(socket.emit).toHaveBeenCalledWith("join", { room: "customer:customer-1:notifications" });
    expect(socket.emit).not.toHaveBeenCalledWith(
      "join",
      expect.objectContaining({ room: expect.stringContaining("ticket:") }),
    );
  });

  it("forwards ticket.updated to onEvent with the unmodified payload", () => {
    renderHook(() => usePortalNotifications("customer-1", onEvent));
    const payload = {
      ticket: { id: "ticket-1", subject: "Cannot log in", status: "RESOLVED" },
      actorUserId: "user-1",
    };

    socket._trigger("ticket.updated", payload);

    expect(onEvent).toHaveBeenCalledWith("ticket.updated", payload);
  });

  it("forwards channel.message.created to onEvent with the unmodified payload", () => {
    renderHook(() => usePortalNotifications("customer-1", onEvent));
    const payload = {
      ticketId: "ticket-1",
      message: { id: "message-1", body: "We're on it", senderUserId: "user-1" },
    };

    socket._trigger("channel.message.created", payload);

    expect(onEvent).toHaveBeenCalledWith("channel.message.created", payload);
  });

  it("does not connect when customerId is null", () => {
    renderHook(() => usePortalNotifications(null, onEvent));

    expect(io).not.toHaveBeenCalled();
  });

  it("does not connect when there is no access token", () => {
    vi.mocked(getAccessToken).mockReturnValueOnce(null);

    renderHook(() => usePortalNotifications("customer-1", onEvent));

    expect(io).not.toHaveBeenCalled();
  });

  it("disconnects and removes listeners on unmount", () => {
    const { unmount } = renderHook(() => usePortalNotifications("customer-1", onEvent));

    unmount();

    expect(socket.off).toHaveBeenCalledWith("ticket.updated", expect.any(Function));
    expect(socket.off).toHaveBeenCalledWith("channel.message.created", expect.any(Function));
    expect(socket.disconnect).toHaveBeenCalledOnce();
  });

  it("does not open a second connection when only the onEvent callback identity changes across re-renders", () => {
    const { rerender } = renderHook(
      ({ cb }: { cb: OnEventMock }) => usePortalNotifications("customer-1", cb),
      { initialProps: { cb: vi.fn() as OnEventMock } },
    );

    expect(io).toHaveBeenCalledOnce();

    rerender({ cb: vi.fn() as OnEventMock });

    expect(io).toHaveBeenCalledOnce();
  });

  it("still delivers events to the latest onEvent after a callback-identity-only re-render", () => {
    const first = vi.fn() as OnEventMock;
    const second = vi.fn() as OnEventMock;
    const { rerender } = renderHook(
      ({ cb }: { cb: OnEventMock }) => usePortalNotifications("customer-1", cb),
      { initialProps: { cb: first } },
    );

    rerender({ cb: second });
    socket._trigger("ticket.updated", {
      ticket: { id: "ticket-1", subject: "x", status: "OPEN" },
      actorUserId: null,
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });

  it("re-establishes the connection when customerId changes", () => {
    const { rerender } = renderHook(({ id }) => usePortalNotifications(id, onEvent), {
      initialProps: { id: "customer-1" },
    });
    expect(io).toHaveBeenCalledTimes(1);

    rerender({ id: "customer-2" });

    expect(socket.disconnect).toHaveBeenCalledOnce();
    expect(io).toHaveBeenCalledTimes(2);
  });
});
