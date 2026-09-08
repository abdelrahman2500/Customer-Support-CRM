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

  // Batch 7 (UX audit) — no dedup existed before this: two deliveries of
  // literally the same event (a socket reconnect replaying a room-join, a
  // duplicate emit) always minted a second toast.
  it("drops a duplicate SLA notification for the same ticket and target type", () => {
    useNotificationsStore.getState().add("sla.at_risk", {
      ticketId: "ticket-1",
      branchId: "branch-1",
      targetType: "response",
      targetAt: "2024-01-01T00:00:00.000Z",
    });
    useNotificationsStore.getState().add("sla.at_risk", {
      ticketId: "ticket-1",
      branchId: "branch-1",
      targetType: "response",
      targetAt: "2024-01-01T00:05:00.000Z",
    });

    expect(useNotificationsStore.getState().notifications).toHaveLength(1);
  });

  it("does not dedupe the same ticket's response target against its resolution target", () => {
    useNotificationsStore.getState().add("sla.at_risk", {
      ticketId: "ticket-1",
      branchId: "branch-1",
      targetType: "response",
      targetAt: "2024-01-01T00:00:00.000Z",
    });
    useNotificationsStore.getState().add("sla.at_risk", {
      ticketId: "ticket-1",
      branchId: "branch-1",
      targetType: "resolution",
      targetAt: "2024-01-01T00:00:00.000Z",
    });

    expect(useNotificationsStore.getState().notifications).toHaveLength(2);
  });

  it("drops a duplicate ticket-escalated notification for the same ticket", () => {
    useNotificationsStore.getState().add("ticket.escalated", {
      ticket: { id: "ticket-1", subject: "Cannot log in" },
      actorUserId: null,
    });
    useNotificationsStore.getState().add("ticket.escalated", {
      ticket: { id: "ticket-1", subject: "Cannot log in" },
      actorUserId: "user-2",
    });

    expect(useNotificationsStore.getState().notifications).toHaveLength(1);
  });

  it("does not dedupe different tickets' escalations against each other", () => {
    useNotificationsStore.getState().add("ticket.escalated", {
      ticket: { id: "ticket-1", subject: "Cannot log in" },
      actorUserId: null,
    });
    useNotificationsStore.getState().add("ticket.escalated", {
      ticket: { id: "ticket-2", subject: "Billing question" },
      actorUserId: null,
    });

    expect(useNotificationsStore.getState().notifications).toHaveLength(2);
  });

  it("allows a fresh notification for the same ticket once the earlier one auto-dismissed", () => {
    useNotificationsStore.getState().add("sla.at_risk", {
      ticketId: "ticket-1",
      branchId: "branch-1",
      targetType: "response",
      targetAt: "2024-01-01T00:00:00.000Z",
    });
    vi.advanceTimersByTime(10_000);

    useNotificationsStore.getState().add("sla.at_risk", {
      ticketId: "ticket-1",
      branchId: "branch-1",
      targetType: "response",
      targetAt: "2024-01-01T01:00:00.000Z",
    });

    expect(useNotificationsStore.getState().notifications).toHaveLength(1);
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
