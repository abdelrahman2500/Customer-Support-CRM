import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
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

  // Story 190 (RD-1.13, recon A11Y-10) — the labelled region and its polite
  // live list stay mounted while empty, so the first notification is
  // inserted into a live region that already exists and is announced.
  it("renders an empty, labelled live region when there are no notifications", () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <NotificationToaster />
      </NextIntlClientProvider>,
    );
    const region = screen.getByRole("region", { name: "Notifications" });
    const list = within(region).getByRole("list");
    expect(list).toHaveAttribute("aria-live", "polite");
    expect(within(list).queryAllByRole("listitem")).toHaveLength(0);
    // 320px-safe position (recon RS-01): a gutter on both edges on phones,
    // a 24rem column at the end edge from sm.
    expect(region).toHaveClass("inset-x-4", "sm:end-4", "sm:w-96", "top-4");
    expect(region).not.toHaveClass("w-full");
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
    seed("ticket.escalated", {
      ticket: { id: "ticket-1", subject: "Cannot log in" },
      actorUserId: null,
    });

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
    seed("ticket.escalated", {
      ticket: { id: "ticket-42", subject: "Cannot log in" },
      actorUserId: null,
    });

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <NotificationToaster />
      </NextIntlClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "View ticket" }));

    expect(push).toHaveBeenCalledWith("/en/tickets/ticket-42");
    expect(useNotificationsStore.getState().notifications).toHaveLength(0);
  });

  // Story 63 — custom notification templates in the live toast.
  it("renders a custom template's substituted text as the message body when one exists for that event type", () => {
    seed("sla.at_risk", {
      ticketId: "12345678-abcd",
      branchId: "branch-1",
      targetType: "response",
      targetAt: "2024-01-01T00:00:00.000Z",
    });

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <NotificationToaster
          templateByEventType={new Map([["sla.at_risk", "Watch ticket {ticketId} ({targetType})"]])}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText("Watch ticket 12345678 (response)")).toBeInTheDocument();
  });

  it("leaves the Badge's event-type label unaffected by a custom template", () => {
    seed("sla.at_risk", {
      ticketId: "12345678-abcd",
      branchId: "branch-1",
      targetType: "response",
      targetAt: "2024-01-01T00:00:00.000Z",
    });

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <NotificationToaster templateByEventType={new Map([["sla.at_risk", "Custom message"]])} />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText("SLA at risk")).toBeInTheDocument();
    expect(screen.getByText("Custom message")).toBeInTheDocument();
  });

  it("falls back to the exact existing message when no template exists for that event type", () => {
    seed("sla.at_risk", {
      ticketId: "12345678-abcd",
      branchId: "branch-1",
      targetType: "response",
      targetAt: "2024-01-01T00:00:00.000Z",
    });

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <NotificationToaster
          templateByEventType={new Map([["ticket.escalated", "Should not apply here"]])}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText(/response target for ticket 12345678 is at risk/i)).toBeInTheDocument();
  });

  it("substitutes {ticketId} (shortened to 8 characters) for a ticket.escalated notification via ticketIdFor's own resolution", () => {
    seed("ticket.escalated", {
      ticket: { id: "ticket-4242", subject: "Cannot log in" },
      actorUserId: null,
    });

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <NotificationToaster
          templateByEventType={new Map([["ticket.escalated", "Escalated: {ticketId}"]])}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText("Escalated: ticket-4")).toBeInTheDocument();
  });
});
