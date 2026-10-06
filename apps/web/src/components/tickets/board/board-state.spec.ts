import { describe, expect, it } from "vitest";
import {
  activeFilterCount,
  columnQuery,
  isAtRiskTicket,
  parseBoardFilters,
  quickViewOf,
  serializeBoardFilters,
  statusSpine,
  withQuickView,
} from "./board-state";
import type { TicketListItem } from "@/lib/tickets-api";

/** Story 216 (PR-3.1) — the board's URL state and pure rules. */
describe("board state", () => {
  it("round-trips its URL with the list's parameter names, defaulting to SLA urgency", () => {
    const filters = parseBoardFilters(
      new URLSearchParams(
        "search=invoice&priority=HIGH&categoryId=c1&unassigned=true&risk=1&sort=newest",
      ),
    );
    expect(filters).toEqual({
      search: "invoice",
      priority: "HIGH",
      categoryId: "c1",
      unassigned: true,
      risk: true,
      sort: "newest",
    });
    expect(serializeBoardFilters(filters).toString()).toBe(
      "view=board&search=invoice&priority=HIGH&categoryId=c1&unassigned=true&risk=1&sort=newest",
    );
    expect(parseBoardFilters(new URLSearchParams("sort=bogus")).sort).toBe("slaUrgency");
    // The default board keeps /tickets clean; view=board only with other state.
    expect(serializeBoardFilters({ sort: "slaUrgency" }).toString()).toBe("");
  });

  it("narrows to one customer (Story 222)", () => {
    const filters = parseBoardFilters(new URLSearchParams("customerId=c9"));
    expect(filters.customerId).toBe("c9");
    expect(serializeBoardFilters(filters).toString()).toBe("view=board&customerId=c9");
    expect(columnQuery("OPEN", filters)).toMatchObject({ customerId: "c9" });
    expect(activeFilterCount(filters)).toBe(1);
  });

  it("maps quick views to filters and back, one scope at a time", () => {
    const base = { sort: "slaUrgency" as const, priority: "LOW" as const };
    const mine = withQuickView(base, "mine", "me");
    expect(mine).toEqual({ ...base, assignedToUserId: "me" });
    expect(quickViewOf(mine, "me")).toBe("mine");
    const unassigned = withQuickView(mine, "unassigned", "me");
    expect(unassigned).toEqual({ ...base, unassigned: true });
    expect(quickViewOf(unassigned, "me")).toBe("unassigned");
    const risk = withQuickView(unassigned, "atRisk", "me");
    expect(quickViewOf(risk, "me")).toBe("atRisk");
    expect(withQuickView(risk, "all", "me")).toEqual(base);
    // Someone else's tickets is a filter, not the "Mine" view.
    expect(quickViewOf({ ...base, assignedToUserId: "other" }, "me")).toBe("all");
  });

  it("counts active filters", () => {
    expect(activeFilterCount({ sort: "updated" })).toBe(0);
    expect(activeFilterCount({ sort: "updated", search: "x", risk: true, categoryId: "c" })).toBe(
      3,
    );
  });

  it("builds each column's query from its status, the filters and the sort", () => {
    expect(
      columnQuery("OPEN", { sort: "slaUrgency", search: "vat", unassigned: true, risk: true }),
    ).toEqual({
      status: "OPEN",
      sortBy: "slaUrgency",
      sortDir: "asc",
      pageSize: 25,
      search: "vat",
      unassigned: "true",
    });
    expect(columnQuery("CLOSED", { sort: "oldest" })).toMatchObject({
      sortBy: "createdAt",
      sortDir: "asc",
    });
    expect(columnQuery("CLOSED", { sort: "updated" })).toMatchObject({
      sortBy: "updatedAt",
      sortDir: "desc",
    });
  });

  it("treats breached and at-risk targets as at risk, but not on-hold or on-track", () => {
    const now = new Date("2026-10-05T12:00:00Z");
    const ticket = (
      responseTargetAt: string,
      onHoldSince: string | null = null,
      status: TicketListItem["status"] = "OPEN",
    ) =>
      ({
        status,
        createdAt: "2026-10-05T08:00:00Z",
        slaTarget: { responseTargetAt, resolutionTargetAt: "2026-10-09T00:00:00Z", onHoldSince },
      }) as unknown as TicketListItem;
    expect(isAtRiskTicket(ticket("2026-10-05T11:00:00Z"), now)).toBe(true);
    expect(isAtRiskTicket(ticket("2026-10-05T12:30:00Z"), now)).toBe(true);
    expect(isAtRiskTicket(ticket("2026-10-05T20:00:00Z"), now)).toBe(false);
    expect(isAtRiskTicket(ticket("2026-10-05T11:00:00Z", "2026-10-05T10:00:00Z"), now)).toBe(false);
    // Demo hardening — only open work can be at risk: a resolved or closed
    // ticket whose targets passed long ago is not in the At-risk view.
    expect(isAtRiskTicket(ticket("2026-10-05T11:00:00Z", null, "IN_PROGRESS"), now)).toBe(true);
    expect(isAtRiskTicket(ticket("2026-10-05T11:00:00Z", null, "RESOLVED"), now)).toBe(false);
    expect(isAtRiskTicket(ticket("2026-10-05T11:00:00Z", null, "CLOSED"), now)).toBe(false);
  });

  it("gives every status its own spine, with Closed neutral", () => {
    expect(statusSpine("OPEN")).toEqual({
      border: "border-info-solid",
      dot: "bg-info-solid",
      top: "border-t-info-solid",
      // Story 229 — the shared spine also names the inline-start edge alone.
      start: "border-s-info-solid",
    });
    expect(statusSpine("IN_PROGRESS").border).toBe("border-progress-solid");
    expect(statusSpine("RESOLVED").border).toBe("border-success-solid");
    expect(statusSpine("CLOSED").border).toBe("border-rule-control");
  });
});
