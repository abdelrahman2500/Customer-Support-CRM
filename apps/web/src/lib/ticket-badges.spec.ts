import { describe, expect, it } from "vitest";
import { ticketPriorityBadgeVariant, ticketStatusBadgeVariant } from "./ticket-badges";

/**
 * Story S-5 — the domain mapping is tested here, in the application, not in
 * `@crm/ui`. The shared package must not know what `IN_PROGRESS` is, so it
 * cannot be the place this contract is pinned down.
 *
 * These expectations are the mappings the three previously-duplicated
 * copies carried, so a regression here means the consolidation changed how
 * a status looks, which it must not.
 */
describe("ticketStatusBadgeVariant", () => {
  it("maps each ticket status to its established variant", () => {
    expect(ticketStatusBadgeVariant("OPEN")).toBe("warning");
    expect(ticketStatusBadgeVariant("IN_PROGRESS")).toBe("secondary");
    expect(ticketStatusBadgeVariant("RESOLVED")).toBe("success");
    expect(ticketStatusBadgeVariant("CLOSED")).toBe("outline");
  });

  it("falls back to the neutral variant for an unknown status", () => {
    // The API could add a status before the UI knows about it; an unstyled
    // neutral badge is the right failure mode, not a crash or a red one.
    expect(ticketStatusBadgeVariant("PENDING_CUSTOMER")).toBe("secondary");
    expect(ticketStatusBadgeVariant("")).toBe("secondary");
  });

  it("gives the two terminal states different treatments", () => {
    // RESOLVED reads as an achievement, CLOSED as archived. Collapsing them
    // would lose a distinction the workspace relies on.
    expect(ticketStatusBadgeVariant("RESOLVED")).not.toBe(ticketStatusBadgeVariant("CLOSED"));
  });
});

describe("ticketPriorityBadgeVariant", () => {
  it("maps each ticket priority to its established variant", () => {
    expect(ticketPriorityBadgeVariant("URGENT")).toBe("destructive");
    expect(ticketPriorityBadgeVariant("HIGH")).toBe("warning");
    expect(ticketPriorityBadgeVariant("MEDIUM")).toBe("secondary");
    expect(ticketPriorityBadgeVariant("LOW")).toBe("secondary");
  });

  it("leaves the two lower priorities visually quiet", () => {
    // Tinting all four would spend the palette on the majority of rows and
    // leave URGENT no louder than the rest.
    expect(ticketPriorityBadgeVariant("LOW")).toBe(ticketPriorityBadgeVariant("MEDIUM"));
  });

  it("falls back to the neutral variant for an unknown priority", () => {
    expect(ticketPriorityBadgeVariant("TRIVIAL")).toBe("secondary");
  });
});
