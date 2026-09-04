import { describe, expect, it } from "vitest";
import { ticketStatusBadgeVariant } from "./ticket-badges";

/**
 * Story S-5 — the portal's own copy of the mapping, tested in the portal.
 *
 * The expectations are intentionally identical to
 * `apps/web/src/lib/ticket-badges.spec.ts`'s, and that is the point: a
 * customer and an agent looking at the same ticket must see the same state
 * rendered the same way. Because the mapping is duplicated across the two
 * applications (sharing it would need a domain package that does not exist
 * yet — `@crm/ui` holds primitives and must not learn what a ticket status
 * is), these two spec files are what keeps the copies honest. If one drifts,
 * the other's assertions still describe the agreed contract.
 */
describe("ticketStatusBadgeVariant", () => {
  it("maps each ticket status to the same variant the agent workspace uses", () => {
    expect(ticketStatusBadgeVariant("OPEN")).toBe("warning");
    expect(ticketStatusBadgeVariant("IN_PROGRESS")).toBe("secondary");
    expect(ticketStatusBadgeVariant("RESOLVED")).toBe("success");
    expect(ticketStatusBadgeVariant("CLOSED")).toBe("outline");
  });

  it("falls back to the neutral variant for an unknown status", () => {
    expect(ticketStatusBadgeVariant("PENDING_CUSTOMER")).toBe("secondary");
    expect(ticketStatusBadgeVariant("")).toBe("secondary");
  });

  it("gives the two terminal states different treatments", () => {
    expect(ticketStatusBadgeVariant("RESOLVED")).not.toBe(ticketStatusBadgeVariant("CLOSED"));
  });
});
