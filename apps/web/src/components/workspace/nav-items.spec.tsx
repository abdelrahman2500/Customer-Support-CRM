import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import {
  NAV_GROUPS,
  NavItemLabel,
  isNavItemActive,
  resolveNavigationLayout,
  visibleNavGroups,
} from "./nav-items";

/** Relative to `apps/web`, which is this package's own vitest root. */
const NAV_ITEMS_SOURCE_PATH = "src/components/workspace/nav-items.tsx";

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
  // Story 213 (PR-2.1, PD-10) — regrouped by what people come to do; the
  // same 20 items (the route guard below is unchanged).
  it("holds the five named groups, in order", () => {
    expect(NAV_GROUPS.map((group) => group.groupKey)).toEqual([
      "work",
      "insights",
      "configure",
      "admin",
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

/**
 * Regression guard. `NavItemLabel` briefly called `useBrandingQuery()`
 * internally to decide its icon spacing, which opened one branding query
 * per nav item — 20 per render — and threw "No QueryClient set" in every
 * spec that renders navigation without a `QueryClientProvider`. The
 * spacing is now an explicit `inMenu` prop the caller passes, so this
 * module must stay free of data fetching entirely: it is a static list
 * plus two pure functions.
 */
describe("NavItemLabel is data-fetching free (regression guard)", () => {
  // `noUncheckedIndexedAccess` is on, so the indexed lookup is narrowed once
  // here rather than non-null-asserted at each use.
  const item = NAV_GROUPS[0]?.items[0];
  if (!item) throw new Error("NAV_GROUPS must have at least one item");

  // Comment lines are stripped by prefix rather than by regex: this file's
  // own doc comments legitimately *mention* `useBrandingQuery()` while
  // explaining why it is no longer called.
  const codeLines = readFileSync(resolve(process.cwd(), NAV_ITEMS_SOURCE_PATH), "utf8")
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("*") && !trimmed.startsWith("/*") && !trimmed.startsWith("//");
    })
    .join("\n");

  it("declares no react-query hook anywhere in the module", () => {
    expect(codeLines).not.toMatch(/use[A-Za-z]*Query\s*\(/);
  });

  it("imports nothing from the hooks directory", () => {
    expect(codeLines).not.toContain('from "@/hooks/');
  });

  // Renders with no QueryClientProvider at all: if a hook ever comes back,
  // this throws rather than silently costing 20 queries per render.
  it("renders standalone, with no QueryClientProvider in the tree", () => {
    const t = ((key: string) => key) as never;

    expect(() =>
      render(<NavItemLabel item={item} t={t} unreadCount={0} unreadCountKnown={false} />),
    ).not.toThrow();
  });

  // Final UX pass — no negative margins anywhere (they pushed the icon onto
  // the menu edge); the row's gap places it. One stroke weight for all.
  it("sizes the icon for its surface, with no pulled-in margins", () => {
    const t = ((key: string) => key) as never;

    const inMenu = render(
      <NavItemLabel item={item} t={t} unreadCount={0} unreadCountKnown={false} inMenu />,
    );
    const menuIcon = inMenu.container.querySelector("svg");
    expect(menuIcon).toHaveClass("h-4", "w-4", "text-ink-subtle");
    expect(menuIcon).not.toHaveClass("-ms-4");
    expect(menuIcon).toHaveAttribute("stroke-width", "1.75");
    inMenu.unmount();

    const inRail = render(
      <NavItemLabel item={item} t={t} unreadCount={0} unreadCountKnown={false} />,
    );
    const icon = inRail.container.querySelector("svg");
    expect(icon).toHaveClass("h-[18px]", "w-[18px]");
    expect(icon).not.toHaveClass("-ms-4");
    expect(icon).toHaveAttribute("stroke-width", "1.75");
  });
});

// Demo hardening — navigation leaves out what the user may not open.
describe("visibleNavGroups", () => {
  const hrefs = (groups: ReturnType<typeof visibleNavGroups>) =>
    groups.flatMap((group) => group.items.map((item) => item.href));

  it("shows every destination while permissions are unknown", () => {
    expect(hrefs(visibleNavGroups(undefined))).toEqual(
      NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href)),
    );
  });

  it("hides the destinations an agent lacks permission for, and the groups left empty", () => {
    const groups = visibleNavGroups(["ticket:read", "customer:read", "kb:read", "sla:read"]);

    expect(hrefs(groups)).toEqual([
      "dashboard",
      "tickets",
      "customers",
      "knowledge-base",
      "notifications",
      "sla-policies",
      "my-sessions",
    ]);
    expect(groups.map((group) => group.groupKey)).toEqual(["work", "configure", "account"]);
  });

  it("shows settings for either administrator permission", () => {
    expect(hrefs(visibleNavGroups(["ai:read"]))).toContain("settings");
    expect(hrefs(visibleNavGroups(["branding:read"]))).toContain("settings");
  });
});
