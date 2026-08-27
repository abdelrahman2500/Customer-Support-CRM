import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { io } from "socket.io-client";
import { BranchNotifications } from "./branch-notifications";
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
});
