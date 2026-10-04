import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
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
    // Story 193 (RD-1.16) — the status is the localized label, not the raw enum.
    expect(
      screen.getByText('Your ticket "Cannot log in" was updated — status: Resolved.'),
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
    // Story 193 (RD-1.16) — the status inside the message is Arabic too.
    const region = screen.getByRole("region");
    expect(region).toHaveTextContent(arMessages.tickets.status.RESOLVED);
    expect(region).not.toHaveTextContent("RESOLVED");
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
