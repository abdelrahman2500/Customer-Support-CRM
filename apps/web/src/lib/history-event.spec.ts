import { describe, expect, it } from "vitest";
import { historyEventKey } from "./history-event";

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
