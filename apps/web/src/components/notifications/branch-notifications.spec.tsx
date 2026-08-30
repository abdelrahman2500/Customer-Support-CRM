import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { io } from "socket.io-client";
import { BranchNotifications } from "./branch-notifications";
import { useNotificationPreferencesQuery } from "@/hooks/use-notification-preferences";
import { useNotificationsStore } from "@/lib/notifications-store";
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

vi.mock("@/hooks/use-notification-preferences", () => ({
  useNotificationPreferencesQuery: vi.fn(),
}));

const mockedUseNotificationPreferencesQuery = vi.mocked(useNotificationPreferencesQuery);

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

describe("BranchNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useNotificationsStore.setState({ notifications: [] });
    // Defaults to "still loading" (no data yet) — Design decision 4: every
    // event type is treated as enabled while the preferences query hasn't
    // resolved, so the pre-existing tests below (which never configure this
    // mock) keep exercising exactly the same "every event renders" behavior
    // they always have.
    mockedUseNotificationPreferencesQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      isSuccess: false,
      error: null,
      refetch: vi.fn(),
    } as never);
  });

  it("wires the realtime hook's events into the store, rendered via the toaster", () => {
    const socket = buildSocketMock();
    vi.mocked(io).mockReturnValue(socket as never);

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <BranchNotifications branchId="branch-1" />
      </NextIntlClientProvider>,
    );

    act(() => {
      socket._trigger("connect");
    });
    expect(socket.emit).toHaveBeenCalledWith("join", { room: "branch:branch-1:notifications" });

    act(() => {
      socket._trigger("sla.breached", {
        ticketId: "ticket-1",
        branchId: "branch-1",
        targetType: "response",
        targetAt: "2024-01-01T00:00:00.000Z",
      });
    });

    expect(screen.getByText("SLA breached")).toBeInTheDocument();
  });

  it("does not attempt to connect when the user has no branchId", () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <BranchNotifications branchId={null} />
      </NextIntlClientProvider>,
    );

    expect(io).not.toHaveBeenCalled();
  });

  it("never forwards an event whose preference is disabled to the store", () => {
    mockedUseNotificationPreferencesQuery.mockReturnValue({
      data: [
        { eventType: "sla.at_risk", inAppEnabled: true },
        { eventType: "sla.breached", inAppEnabled: false },
        { eventType: "ticket.escalated", inAppEnabled: true },
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
        <BranchNotifications branchId="branch-1" />
      </NextIntlClientProvider>,
    );

    act(() => {
      socket._trigger("sla.breached", {
        ticketId: "ticket-1",
        branchId: "branch-1",
        targetType: "response",
        targetAt: "2024-01-01T00:00:00.000Z",
      });
    });

    expect(screen.queryByText("SLA breached")).not.toBeInTheDocument();
  });

  it("still forwards an event whose preference is enabled", () => {
    mockedUseNotificationPreferencesQuery.mockReturnValue({
      data: [
        { eventType: "sla.at_risk", inAppEnabled: true },
        { eventType: "sla.breached", inAppEnabled: false },
        { eventType: "ticket.escalated", inAppEnabled: true },
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
        <BranchNotifications branchId="branch-1" />
      </NextIntlClientProvider>,
    );

    act(() => {
      socket._trigger("sla.at_risk", {
        ticketId: "ticket-1",
        branchId: "branch-1",
        targetType: "response",
        targetAt: "2024-01-01T00:00:00.000Z",
      });
    });

    expect(screen.getByText("SLA at risk")).toBeInTheDocument();
  });
});
