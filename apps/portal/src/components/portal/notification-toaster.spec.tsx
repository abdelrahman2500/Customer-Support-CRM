import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { NotificationToaster } from "./notification-toaster";
import { usePortalNotificationsStore } from "@/lib/notifications-store";
import enMessages from "../../../messages/en.json";
import arMessages from "../../../messages/ar.json";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push }),
}));

function seed(eventType: "ticket.updated" | "channel.message.created", payload: unknown) {
  usePortalNotificationsStore.setState({
    notifications: [{ id: "n1", eventType, payload: payload as never, receivedAt: Date.now() }],
  });
}

describe("NotificationToaster", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePortalNotificationsStore.setState({ notifications: [] });
  });

  it("renders nothing when there are no notifications", () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <NotificationToaster />
      </NextIntlClientProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a real, translated message for ticket.updated (English)", () => {
    seed("ticket.updated", {
      ticket: { id: "ticket-1", subject: "Cannot log in", status: "RESOLVED" },
      actorUserId: "user-1",
    });

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <NotificationToaster />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText("Ticket updated")).toBeInTheDocument();
    expect(
      screen.getByText('Your ticket "Cannot log in" was updated — status: RESOLVED.'),
    ).toBeInTheDocument();
  });

  it("renders a real, translated message for ticket.updated (Arabic, RTL-appropriate content)", () => {
    seed("ticket.updated", {
      ticket: { id: "ticket-1", subject: "Cannot log in", status: "RESOLVED" },
      actorUserId: "user-1",
    });

    render(
      <NextIntlClientProvider locale="ar" messages={arMessages}>
        <NotificationToaster />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText("تم تحديث التذكرة")).toBeInTheDocument();
  });

  it("renders a body preview for channel.message.created", () => {
    seed("channel.message.created", {
      ticketId: "ticket-1",
      message: { id: "message-1", body: "We're looking into this now.", senderUserId: "user-1" },
    });

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <NotificationToaster />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText("New reply")).toBeInTheDocument();
    expect(
      screen.getByText(/You have a new reply on your ticket\. We're looking into this now\./),
    ).toBeInTheDocument();
  });

  it("truncates a long message body preview", () => {
    const longBody = "x".repeat(200);
    seed("channel.message.created", {
      ticketId: "ticket-1",
      message: { id: "message-1", body: longBody, senderUserId: "user-1" },
    });

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <NotificationToaster />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText(new RegExp(`${"x".repeat(120)}…`))).toBeInTheDocument();
  });

  it("dismisses a notification when its dismiss control is clicked", () => {
    seed("ticket.updated", {
      ticket: { id: "ticket-1", subject: "Cannot log in", status: "OPEN" },
      actorUserId: null,
    });

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <NotificationToaster />
      </NextIntlClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(usePortalNotificationsStore.getState().notifications).toHaveLength(0);
  });

  it("navigates to the ticket and dismisses the notification on click-through", () => {
    seed("ticket.updated", {
      ticket: { id: "ticket-42", subject: "Cannot log in", status: "OPEN" },
      actorUserId: null,
    });

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <NotificationToaster />
      </NextIntlClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "View ticket" }));

    expect(push).toHaveBeenCalledWith("/en/tickets/ticket-42");
    expect(usePortalNotificationsStore.getState().notifications).toHaveLength(0);
  });

  it("navigates using ticketId for a channel.message.created notification", () => {
    seed("channel.message.created", {
      ticketId: "ticket-99",
      message: { id: "message-1", body: "Reply", senderUserId: "user-1" },
    });

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <NotificationToaster />
      </NextIntlClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "View ticket" }));

    expect(push).toHaveBeenCalledWith("/en/tickets/ticket-99");
  });
});
