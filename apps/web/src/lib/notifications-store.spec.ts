import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNotificationsStore } from "./notifications-store";

describe("useNotificationsStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useNotificationsStore.setState({ notifications: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("adds a notification to the front of the list", () => {
    useNotificationsStore.getState().add("sla.at_risk", {
      ticketId: "ticket-1",
      branchId: "branch-1",
      targetType: "response",
      targetAt: "2024-01-01T00:00:00.000Z",
    });

    const { notifications } = useNotificationsStore.getState();
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.eventType).toBe("sla.at_risk");
  });

  it("dismisses a notification by id", () => {
    useNotificationsStore.getState().add("ticket.escalated", {
      ticket: { id: "ticket-1", subject: "Cannot log in" },
      actorUserId: null,
    });
    const id = useNotificationsStore.getState().notifications[0]!.id;

    useNotificationsStore.getState().dismiss(id);

    expect(useNotificationsStore.getState().notifications).toHaveLength(0);
  });

  it("auto-dismisses a notification after the timeout", () => {
    useNotificationsStore.getState().add("sla.breached", {
      ticketId: "ticket-1",
      branchId: "branch-1",
      targetType: "resolution",
      targetAt: "2024-01-01T00:00:00.000Z",
    });
    expect(useNotificationsStore.getState().notifications).toHaveLength(1);

    vi.advanceTimersByTime(10_000);

    expect(useNotificationsStore.getState().notifications).toHaveLength(0);
  });

  it("caps the visible list at 5, dropping the oldest", () => {
    for (let i = 0; i < 6; i++) {
      useNotificationsStore.getState().add("sla.at_risk", {
        ticketId: `ticket-${i}`,
        branchId: "branch-1",
        targetType: "response",
        targetAt: "2024-01-01T00:00:00.000Z",
      });
    }

    const { notifications } = useNotificationsStore.getState();
    expect(notifications).toHaveLength(5);
    // Most recent (ticket-5) is first; oldest (ticket-0) was dropped.
    expect(notifications[0]?.payload).toMatchObject({ ticketId: "ticket-5" });
    expect(notifications.some((n) => "ticketId" in n.payload && n.payload.ticketId === "ticket-0")).toBe(
      false,
    );
  });
});
