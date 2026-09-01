import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePortalNotificationsStore } from "./notifications-store";

describe("usePortalNotificationsStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    usePortalNotificationsStore.setState({ notifications: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("adds a notification to the front of the list", () => {
    usePortalNotificationsStore.getState().add("ticket.updated", {
      ticket: { id: "ticket-1", subject: "Cannot log in", status: "OPEN" },
      actorUserId: "user-1",
    });

    const { notifications } = usePortalNotificationsStore.getState();
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.eventType).toBe("ticket.updated");
  });

  it("dismisses a notification by id", () => {
    usePortalNotificationsStore.getState().add("channel.message.created", {
      ticketId: "ticket-1",
      message: { id: "message-1", body: "We're on it", senderUserId: "user-1" },
    });
    const id = usePortalNotificationsStore.getState().notifications[0]!.id;

    usePortalNotificationsStore.getState().dismiss(id);

    expect(usePortalNotificationsStore.getState().notifications).toHaveLength(0);
  });

  it("auto-dismisses a notification after the timeout", () => {
    usePortalNotificationsStore.getState().add("ticket.updated", {
      ticket: { id: "ticket-1", subject: "Cannot log in", status: "RESOLVED" },
      actorUserId: null,
    });
    expect(usePortalNotificationsStore.getState().notifications).toHaveLength(1);

    vi.advanceTimersByTime(10_000);

    expect(usePortalNotificationsStore.getState().notifications).toHaveLength(0);
  });

  it("caps the visible list at 5, dropping the oldest", () => {
    for (let i = 0; i < 6; i++) {
      usePortalNotificationsStore.getState().add("channel.message.created", {
        ticketId: `ticket-${i}`,
        message: { id: `message-${i}`, body: "Reply", senderUserId: "user-1" },
      });
    }

    const { notifications } = usePortalNotificationsStore.getState();
    expect(notifications).toHaveLength(5);
    // Most recent (ticket-5) is first; oldest (ticket-0) was dropped.
    expect(notifications[0]?.payload).toMatchObject({ ticketId: "ticket-5" });
    expect(
      notifications.some((n) => "ticketId" in n.payload && n.payload.ticketId === "ticket-0"),
    ).toBe(false);
  });
});
