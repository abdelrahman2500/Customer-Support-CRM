import { describe, expect, it } from "vitest";
import {
  TICKET_PRIORITIES,
  TICKET_PRIORITY_PRESENTATION,
  TICKET_STATUSES,
  TICKET_STATUS_PRESENTATION,
  ticketPriorityPresentation,
  ticketStatusPresentation,
} from "@crm/shared";

/**
 * Story 191 (RD-1.14) — `@crm/shared` has no test runner, so its ticket
 * presentation data is pinned here, against
 * docs/architecture/13-design-language.md "Status semantics".
 */
describe("@crm/shared ticket presentation", () => {
  it("maps statuses exactly as the design language says", () => {
    expect(TICKET_STATUSES.map((s) => TICKET_STATUS_PRESENTATION[s].tone)).toEqual([
      "info",
      "progress",
      "success",
      "neutral",
    ]);
  });

  it("maps priorities exactly as the design language says", () => {
    expect(TICKET_PRIORITIES.map((p) => TICKET_PRIORITY_PRESENTATION[p].tone)).toEqual([
      "neutral",
      "neutral",
      "warning",
      "danger",
    ]);
  });

  it("keeps statuses off warning/danger and priorities off info/progress", () => {
    for (const s of TICKET_STATUSES) {
      expect(["warning", "danger"]).not.toContain(TICKET_STATUS_PRESENTATION[s].tone);
    }
    for (const p of TICKET_PRIORITIES) {
      expect(["info", "progress"]).not.toContain(TICKET_PRIORITY_PRESENTATION[p].tone);
    }
  });

  it("gives every value its own icon key", () => {
    const icons = [
      ...TICKET_STATUSES.map((s) => TICKET_STATUS_PRESENTATION[s].icon),
      ...TICKET_PRIORITIES.map((p) => TICKET_PRIORITY_PRESENTATION[p].icon),
    ];
    expect(new Set(icons).size).toBe(8);
  });

  it("looks values up tolerantly", () => {
    expect(ticketStatusPresentation("IN_PROGRESS").tone).toBe("progress");
    expect(ticketPriorityPresentation("URGENT").tone).toBe("danger");
    expect(ticketStatusPresentation("ARCHIVED").tone).toBe("neutral");
    expect(ticketPriorityPresentation("").tone).toBe("neutral");
    // Not fooled by Object.prototype members.
    expect(ticketStatusPresentation("toString").tone).toBe("neutral");
  });
});
