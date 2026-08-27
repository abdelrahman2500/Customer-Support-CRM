import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { NotificationToaster } from "./notification-toaster";
import { useNotificationsStore } from "@/lib/notifications-store";
import enMessages from "../../../messages/en.json";
import arMessages from "../../../messages/ar.json";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push }),
}));

function seed(eventType: "sla.at_risk" | "sla.breached" | "ticket.escalated", payload: unknown) {
  useNotificationsStore.setState({
    notifications: [{ id: "n1", eventType, payload: payload as never, receivedAt: Date.now() }],
  });
}

describe("NotificationToaster", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useNotificationsStore.setState({ notifications: [] });
  });

  it("renders nothing when there are no notifications", () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <NotificationToaster />
      </NextIntlClientProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a real, translated message for sla.at_risk (English)", () => {
    seed("sla.at_risk", {
      ticketId: "12345678-abcd",
      branchId: "branch-1",
      targetType: "response",
      targetAt: "2024-01-01T00:00:00.000Z",
    });

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <NotificationToaster />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText("SLA at risk")).toBeInTheDocument();
    expect(screen.getByText(/response target for ticket 12345678 is at risk/i)).toBeInTheDocument();
  });

  it("renders a real, translated message for sla.at_risk (Arabic, RTL-appropriate content)", () => {
    seed("sla.at_risk", {
      ticketId: "12345678-abcd",
      branchId: "branch-1",
      targetType: "response",
      targetAt: "2024-01-01T00:00:00.000Z",
    });

    render(
      <NextIntlClientProvider locale="ar" messages={arMessages}>
        <NotificationToaster />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText("اتفاقية الخدمة في خطر")).toBeInTheDocument();
  });

  it("renders the ticket subject for ticket.escalated", () => {
    seed("ticket.escalated", { ticket: { id: "ticket-1", subject: "Cannot log in" }, actorUserId: null });

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <NotificationToaster />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText(/Ticket escalated: Cannot log in/)).toBeInTheDocument();
  });

  it("dismisses a notification when its dismiss control is clicked", () => {
    seed("sla.breached", {
      ticketId: "ticket-1",
      branchId: "branch-1",
      targetType: "resolution",
      targetAt: "2024-01-01T00:00:00.000Z",
    });

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <NotificationToaster />
      </NextIntlClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(useNotificationsStore.getState().notifications).toHaveLength(0);
  });

  it("navigates to the ticket and dismisses the notification on click-through", () => {
    seed("ticket.escalated", { ticket: { id: "ticket-42", subject: "Cannot log in" }, actorUserId: null });

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <NotificationToaster />
      </NextIntlClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "View ticket" }));

    expect(push).toHaveBeenCalledWith("/en/tickets/ticket-42");
    expect(useNotificationsStore.getState().notifications).toHaveLength(0);
  });
});
