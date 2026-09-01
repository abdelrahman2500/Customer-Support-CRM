import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { io } from "socket.io-client";
import { PortalNotifications } from "./portal-notifications";
import { usePortalNotificationsStore } from "@/lib/notifications-store";
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
});
