import { describe, expect, it } from "vitest";
import { NAV_GROUPS, isNavItemActive, resolveNavigationLayout } from "./nav-items";

/**
 * Story 129 — the shared navigation module's own two rules, tested once
 * here rather than re-derived in each presentation's spec. Both
 * `WorkspaceNavbar` and `WorkspaceSidebar` import exactly these, so a
 * regression here is a regression in both at the same time — which is the
 * whole point of the extraction.
 */
describe("isNavItemActive (Story 96's rule)", () => {
  it("matches the item's own route exactly", () => {
    expect(isNavItemActive("/en/tickets", "/en/tickets")).toBe(true);
  });

  it("still matches from a nested detail route", () => {
    expect(isNavItemActive("/en/tickets/ticket-1", "/en/tickets")).toBe(true);
  });

  // The reason this is `startsWith(`${href}/`)` and not `startsWith(href)`:
  // a sibling route that merely begins with the same characters is a
  // different destination and must not light up this item.
  it("does not match a sibling route that shares a string prefix", () => {
    expect(isNavItemActive("/en/tickets-archive", "/en/tickets")).toBe(false);
  });

  it("does not match an unrelated route", () => {
    expect(isNavItemActive("/en/dashboard", "/en/tickets")).toBe(false);
  });

  it("treats a null pathname as no match rather than throwing", () => {
    expect(isNavItemActive(null, "/en/tickets")).toBe(false);
  });
});

describe("resolveNavigationLayout (Story 129)", () => {
  it("resolves SIDEBAR to SIDEBAR", () => {
    expect(resolveNavigationLayout("SIDEBAR")).toBe("SIDEBAR");
  });

  it("resolves NAVBAR to NAVBAR", () => {
    expect(resolveNavigationLayout("NAVBAR")).toBe("NAVBAR");
  });

  // The backward-compatibility guarantee: an unconfigured branch — which
  // is every branch that existed before this story — renders exactly the
  // presentation it already had.
  it("resolves an unconfigured branch (null) to NAVBAR", () => {
    expect(resolveNavigationLayout(null)).toBe("NAVBAR");
  });

  it("resolves a still-loading or failed query (undefined) to NAVBAR", () => {
    expect(resolveNavigationLayout(undefined)).toBe("NAVBAR");
  });
});

describe("NAV_GROUPS", () => {
  it("still holds the six named groups, in order", () => {
    expect(NAV_GROUPS.map((group) => group.groupKey)).toEqual([
      "workspace",
      "ticketingConfig",
      "reporting",
      "administration",
      "system",
      "account",
    ]);
  });

  // The regression guard against the duplicated-route failure mode the
  // extraction exists to prevent: if a route were ever re-declared in a
  // variant and copied back here, two nav items would point at the same
  // screen and both would light up as active.
  it("declares every route exactly once across all groups", () => {
    const hrefs = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href));
    expect(hrefs).toHaveLength(20);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("gives every item a label key and an icon", () => {
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        expect(item.labelKey, item.href).toMatch(/^nav\./);
        expect(item.icon, item.href).toBeTypeOf("object");
      }
    }
  });
});
