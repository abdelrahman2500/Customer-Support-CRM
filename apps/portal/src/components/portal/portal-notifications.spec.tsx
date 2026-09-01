import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { io } from "socket.io-client";
import { PortalNotifications } from "./portal-notifications";
import { usePortalNotificationsStore } from "@/lib/notifications-store";
import { usePortalNotificationPreferencesQuery } from "@/hooks/use-portal-notification-preferences";
import enMessages from "../../../messages/en.json";

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/api", () => ({
  getAccessToken: () => "test-token",
  getSocketBaseUrl: () => "http://localhost:3001",
}));

vi.mock("socket.io-client", () => ({ io: vi.fn() }));

vi.mock("@/hooks/use-portal-notification-preferences", () => ({
  usePortalNotificationPreferencesQuery: vi.fn(),
}));

const mockedUsePortalNotificationPreferencesQuery = vi.mocked(usePortalNotificationPreferencesQuery);

function buildSocketMock() {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  return {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => handlers.set(event, handler)),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    _trigger: (event: string, ...args: unknown[]) => handlers.get(event)?.(...args),
  };
}

describe("PortalNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePortalNotificationsStore.setState({ notifications: [] });
    // Defaults to "still loading" (no data yet) — every event type is
    // treated as enabled while the preferences query hasn't resolved, so
    // the pre-existing test below (which never configures this mock) keeps
    // exercising exactly the same "every event renders" behavior it always
    // has.
    mockedUsePortalNotificationPreferencesQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      isSuccess: false,
      error: null,
      refetch: vi.fn(),
    } as never);
  });

  it("joins customer:{id}:notifications and renders a toast when an event arrives", () => {
    const socket = buildSocketMock();
    vi.mocked(io).mockReturnValue(socket as never);

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <PortalNotifications customerId="customer-1" />
      </NextIntlClientProvider>,
    );

    act(() => {
      socket._trigger("connect");
    });
    expect(socket.emit).toHaveBeenCalledWith("join", { room: "customer:customer-1:notifications" });

    act(() => {
      socket._trigger("ticket.updated", {
        ticket: { id: "ticket-1", subject: "Cannot log in", status: "RESOLVED" },
        actorUserId: "user-1",
      });
    });

    expect(screen.getByText("Ticket updated")).toBeInTheDocument();
    expect(usePortalNotificationsStore.getState().notifications).toHaveLength(1);
  });

  it("never forwards an event whose preference is disabled to the store", () => {
    mockedUsePortalNotificationPreferencesQuery.mockReturnValue({
      data: [
        { eventType: "ticket.updated", inAppEnabled: false },
        { eventType: "channel.message.created", inAppEnabled: true },
      ],
      isLoading: false,
      isError: false,
      isSuccess: true,
      error: null,
      refetch: vi.fn(),
    } as never);
    const socket = buildSocketMock();
    vi.mocked(io).mockReturnValue(socket as never);

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <PortalNotifications customerId="customer-1" />
      </NextIntlClientProvider>,
    );

    act(() => {
      socket._trigger("ticket.updated", {
        ticket: { id: "ticket-1", subject: "Cannot log in", status: "RESOLVED" },
        actorUserId: "user-1",
      });
    });

    expect(screen.queryByText("Ticket updated")).not.toBeInTheDocument();
    expect(usePortalNotificationsStore.getState().notifications).toHaveLength(0);
  });

  it("still forwards an event whose preference is enabled", () => {
    mockedUsePortalNotificationPreferencesQuery.mockReturnValue({
      data: [
        { eventType: "ticket.updated", inAppEnabled: false },
        { eventType: "channel.message.created", inAppEnabled: true },
      ],
      isLoading: false,
      isError: false,
      isSuccess: true,
      error: null,
      refetch: vi.fn(),
    } as never);
    const socket = buildSocketMock();
    vi.mocked(io).mockReturnValue(socket as never);

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <PortalNotifications customerId="customer-1" />
      </NextIntlClientProvider>,
    );

    act(() => {
      socket._trigger("channel.message.created", {
        ticketId: "ticket-1",
        message: { id: "msg-1", body: "We're looking into this." },
      });
    });

    expect(screen.getByText("New reply")).toBeInTheDocument();
    expect(usePortalNotificationsStore.getState().notifications).toHaveLength(1);
  });
});
