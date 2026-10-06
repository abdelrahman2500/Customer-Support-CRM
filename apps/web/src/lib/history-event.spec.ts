import { describe, expect, it } from "vitest";
import { historyEventKey, describeHistoryChange } from "./history-event";

/** Story 193 (RD-1.16) — every type the API's ticket-history listener writes
 * has its own label key; anything else falls back instead of leaking. */
describe("historyEventKey", () => {
  it("maps each event type the API writes to its label key", () => {
    expect(historyEventKey("ticket.created")).toBe("created");
    expect(historyEventKey("ticket.updated")).toBe("updated");
    expect(historyEventKey("ticket.recategorized")).toBe("recategorized");
    expect(historyEventKey("ticket.escalated")).toBe("escalated");
  });

  it("falls back to 'other' for unknown types, including Object.prototype names", () => {
    expect(historyEventKey("ticket.merged")).toBe("other");
    expect(historyEventKey("")).toBe("other");
    expect(historyEventKey("toString")).toBe("other");
  });
});

// Demo hardening — what an update changed.
describe("describeHistoryChange", () => {
  const before = { status: "OPEN", priority: "MEDIUM", assignedToUserId: null, categoryId: "c1", subject: "A" };

  it("names each changed field, in a fixed order", () => {
    expect(
      describeHistoryChange(before, {
        ...before,
        subject: "B",
        categoryId: "c2",
        assignedToUserId: "u1",
        priority: "HIGH",
        status: "RESOLVED",
      }),
    ).toEqual([
      { field: "status", value: "RESOLVED" },
      { field: "priority", value: "HIGH" },
      { field: "assignee", value: "u1" },
      { field: "category" },
      { field: "subject" },
    ]);
  });

  it("reports an unassignment as a null assignee", () => {
    expect(describeHistoryChange({ ...before, assignedToUserId: "u1" }, before)).toEqual([
      { field: "assignee", value: null },
    ]);
  });

  it("is empty without an earlier snapshot or when nothing it names changed", () => {
    expect(describeHistoryChange(undefined, before)).toEqual([]);
    expect(describeHistoryChange(before, { ...before, updatedAt: "later" })).toEqual([]);
  });
});
