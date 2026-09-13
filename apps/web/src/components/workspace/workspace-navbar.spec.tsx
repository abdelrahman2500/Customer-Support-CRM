import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkspaceNavbar } from "./workspace-navbar";

/**
 * Story 129 — the `NAVBAR` presentation, and the default one. Every case
 * here that concerns routes, labels, active-route marking, the unread
 * badge or RTL was re-homed from the deleted `workspace-nav.spec.tsx` and
 * must keep passing: the presentation changed (wrapped rows became six
 * `DropdownMenu`s), the set of destinations and the rules governing them
 * did not.
 *
 * The mock block is `workspace-nav.spec.tsx`'s own, reduced to the two
 * modules this component actually touches.
 */
let pathname = "/en/tickets";
let locale = "en";

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale }),
  usePathname: () => pathname,
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
}));

const GROUP_KEYS = [
  "workspace",
  "ticketingConfig",
  "reporting",
  "administration",
  "system",
  "account",
] as const;

/** The navbar's own accessible name for a group trigger, per Story 129's
 * `nav.groupMenuLabel` key, resolved through this file's key-echo mock. */
function triggerName(groupKey: string): string {
  return `nav.groupMenuLabel:${JSON.stringify({ group: `nav.groups.${groupKey}` })}`;
}

// Mirrors the deleted spec's own `EXPECTED_LINKS` — the full 20-item list,
// which is this story's permission-visibility regression guard: both
// presentations render every destination, exactly as before.
const EXPECTED_LINKS: Array<[group: string, name: string, href: string]> = [
  ["workspace", "nav.dashboard", "/en/dashboard"],
  ["workspace", "nav.tickets", "/en/tickets"],
  ["workspace", "nav.customers", "/en/customers"],
  ["workspace", "nav.knowledgeBase", "/en/knowledge-base"],
  ["workspace", "nav.kbCategories", "/en/kb-categories"],
  ["workspace", "nav.notifications", "/en/notifications"],
  ["ticketingConfig", "nav.slaPolicies", "/en/sla-policies"],
  ["ticketingConfig", "nav.ticketCategories", "/en/ticket-categories"],
  ["ticketingConfig", "nav.automationRules", "/en/automation-rules"],
  ["ticketingConfig", "nav.quickReplies", "/en/quick-replies"],
  ["reporting", "nav.reports", "/en/reports"],
  ["reporting", "nav.auditLogs", "/en/audit-logs"],
  ["administration", "nav.branches", "/en/branches"],
  ["administration", "nav.users", "/en/users"],
  ["administration", "nav.roles", "/en/roles"],
  ["system", "nav.notificationTemplates", "/en/notification-templates"],
  ["system", "nav.webhookSubscriptions", "/en/webhook-subscriptions"],
  ["system", "nav.apiKeys", "/en/api-keys"],
  ["account", "nav.settings", "/en/settings"],
  ["account", "nav.mySessions", "/en/my-sessions"],
];

function renderNavbar(props: { unreadCount?: number; unreadCountKnown?: boolean } = {}) {
  return render(
    <WorkspaceNavbar
      unreadCount={props.unreadCount ?? 0}
      unreadCountKnown={props.unreadCountKnown ?? false}
    />,
  );
}

/** Opens one group's menu and returns it. Radix only mounts
 * `DropdownMenuContent` once opened, so exactly one menu exists at a time
 * and no two link sets ever coexist in the DOM. */
async function openGroup(groupKey: string) {
  const clickUser = userEvent.setup();
  await clickUser.click(screen.getByRole("button", { name: triggerName(groupKey) }));
  return screen.findByRole("menu");
}

describe("WorkspaceNavbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pathname = "/en/tickets";
    locale = "en";
  });

  it("labels the nav landmark with an accessible name", () => {
    renderNavbar();

    expect(screen.getByRole("navigation", { name: "nav.label" })).toBeInTheDocument();
  });

  it("renders exactly one trigger per group — six, never a wrapping row of 20 links", () => {
    renderNavbar();

    const nav = screen.getByRole("navigation", { name: "nav.label" });
    expect(within(nav).getAllByRole("button")).toHaveLength(6);
    for (const groupKey of GROUP_KEYS) {
      expect(within(nav).getByRole("button", { name: triggerName(groupKey) })).toBeInTheDocument();
    }
  });

  it("shows every group's own name on its trigger", () => {
    renderNavbar();

    const nav = screen.getByRole("navigation", { name: "nav.label" });
    for (const groupKey of GROUP_KEYS) {
      expect(within(nav).getByText(`nav.groups.${groupKey}`)).toBeInTheDocument();
    }
  });

  // The permission-visibility regression guard: this story must not have
  // introduced client-side gating, so all 20 destinations are still
  // reachable — now spread across the six menus.
  it("reveals every one of the 20 destinations across the six menus, with the right hrefs", async () => {
    for (const groupKey of GROUP_KEYS) {
      const { unmount } = renderNavbar();
      const menu = await openGroup(groupKey);
      for (const [group, name, href] of EXPECTED_LINKS.filter(([g]) => g === groupKey)) {
        expect(within(menu).getByRole("menuitem", { name }), `${group}/${name}`).toHaveAttribute(
          "href",
          href,
        );
      }
      unmount();
    }
  });

  it("no longer links branding/ai-settings/business-hours directly — settings' own tabs cover them", async () => {
    renderNavbar();
    const menu = await openGroup("account");

    expect(within(menu).queryByRole("menuitem", { name: "nav.branding" })).not.toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: "nav.aiSettings" })).not.toBeInTheDocument();
    expect(
      within(menu).queryByRole("menuitem", { name: "nav.businessHours" }),
    ).not.toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "nav.settings" })).toHaveAttribute(
      "href",
      "/en/settings",
    );
  });

  it("renders a decorative icon inside every item", async () => {
    renderNavbar();
    const menu = await openGroup("workspace");

    const ticketsItem = within(menu).getByRole("menuitem", { name: "nav.tickets" });
    const icon = ticketsItem.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute("aria-hidden");
  });

  // Story 96 — Navigation & Route Robustness.
  describe("active-route indication (Story 96)", () => {
    it("marks the current top-level route's item as the current page", async () => {
      pathname = "/en/tickets";
      renderNavbar();
      const menu = await openGroup("workspace");

      expect(within(menu).getByRole("menuitem", { name: "nav.tickets" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      expect(within(menu).getByRole("menuitem", { name: "nav.dashboard" })).not.toHaveAttribute(
        "aria-current",
      );
    });

    it("still marks the top-level item current from a nested detail route", async () => {
      pathname = "/en/tickets/ticket-1";
      renderNavbar();
      const menu = await openGroup("workspace");

      expect(within(menu).getByRole("menuitem", { name: "nav.tickets" })).toHaveAttribute(
        "aria-current",
        "page",
      );
    });

    it("marks no item current on a route no nav item matches", async () => {
      pathname = "/en/nowhere";
      renderNavbar();
      const menu = await openGroup("workspace");

      for (const item of within(menu).getAllByRole("menuitem")) {
        expect(item).not.toHaveAttribute("aria-current");
      }
    });

    // Story 129 — with every menu closed, the section the user is in must
    // still be identifiable; otherwise turning the groups into menus would
    // have hidden the active-route cue entirely.
    it("marks the trigger of the group holding the active item, with every menu closed", () => {
      pathname = "/en/tickets";
      renderNavbar();

      const active = screen.getByRole("button", { name: triggerName("workspace") });
      const inactive = screen.getByRole("button", { name: triggerName("reporting") });
      expect(active).toHaveClass("border-accent");
      expect(inactive).toHaveClass("border-transparent");
      expect(inactive).not.toHaveClass("border-accent");
    });

    it("marks the group trigger from a nested detail route too", () => {
      pathname = "/en/tickets/ticket-1";
      renderNavbar();

      expect(screen.getByRole("button", { name: triggerName("workspace") })).toHaveClass(
        "border-accent",
      );
    });
  });

  // Story 92 — Notification Read-State (unread-count badge).
  describe("unread-notification badge (Story 92)", () => {
    it("renders no badge anywhere while the unread-count query is loading or erroring", async () => {
      renderNavbar({ unreadCount: 0, unreadCountKnown: false });

      expect(screen.queryByLabelText(/unreadNotificationsLabel/)).not.toBeInTheDocument();
      const menu = await openGroup("workspace");
      expect(within(menu).queryByLabelText(/unreadNotificationsLabel/)).not.toBeInTheDocument();
    });

    it("renders no badge when the unread count is 0", async () => {
      renderNavbar({ unreadCount: 0, unreadCountKnown: true });

      expect(screen.queryByLabelText(/unreadNotificationsLabel/)).not.toBeInTheDocument();
      const menu = await openGroup("workspace");
      expect(within(menu).queryByLabelText(/unreadNotificationsLabel/)).not.toBeInTheDocument();
    });

    it("renders the unread count next to the notifications item once it is positive", async () => {
      renderNavbar({ unreadCount: 3, unreadCountKnown: true });
      const menu = await openGroup("workspace");

      const item = within(menu).getByRole("menuitem", { name: /nav\.notifications/ });
      expect(within(item).getByLabelText(/unreadNotificationsLabel/)).toHaveTextContent("3");
    });

    // Without this, an unread notification would be invisible behind a
    // closed menu until the user happened to open that one group.
    it("mirrors the count onto the holding group's trigger, so it is visible with the menu closed", () => {
      renderNavbar({ unreadCount: 3, unreadCountKnown: true });

      const trigger = screen.getByRole("button", { name: triggerName("workspace") });
      expect(within(trigger).getByLabelText(/unreadNotificationsLabel/)).toHaveTextContent("3");
    });

    it("does not put the count on a group that holds no unread item", () => {
      renderNavbar({ unreadCount: 3, unreadCountKnown: true });

      const trigger = screen.getByRole("button", { name: triggerName("reporting") });
      expect(within(trigger).queryByLabelText(/unreadNotificationsLabel/)).not.toBeInTheDocument();
    });
  });

  describe("RTL and i18n", () => {
    /**
     * Story S-6 — these are `next/link`s, so every one of them is a
     * client-side transition. The locale segment is the thing most easily
     * lost: a link built from the wrong source would either drop `/ar` or
     * double it into `/ar/ar`.
     */
    it("keeps the active locale segment on every item under /ar", async () => {
      locale = "ar";
      pathname = "/ar/tickets";
      for (const groupKey of GROUP_KEYS) {
        const { unmount } = renderNavbar();
        const menu = await openGroup(groupKey);
        for (const [, name, href] of EXPECTED_LINKS.filter(([g]) => g === groupKey)) {
          const arabicHref = href.replace("/en/", "/ar/");
          expect(within(menu).getByRole("menuitem", { name }), name).toHaveAttribute(
            "href",
            arabicHref,
          );
          expect(arabicHref.startsWith("/ar/ar")).toBe(false);
        }
        unmount();
      }
    });

    // Workspace Navigation UX audit — RTL regression guard, re-homed. jsdom
    // does not compute real box layout, so this cannot assert the bar
    // actually mirrors visually; what it can and does assert is that the
    // classes driving that layout are logical (`border-s-2`, flex direction
    // reversed by `dir="rtl"` for free) rather than physical ones that
    // would stay pinned to one side under either direction.
    it("uses only logical-direction classes on the triggers, never a physical left/right one", () => {
      renderNavbar();

      const nav = screen.getByRole("navigation", { name: "nav.label" });
      for (const trigger of within(nav).getAllByRole("button")) {
        const classes = trigger.className.split(/\s+/);
        expect(classes.some((c) => c.startsWith("border-s-") || c === "border-transparent")).toBe(
          true,
        );
        expect(classes.some((c) => /^border-[lr]-/.test(c))).toBe(false);
        expect(classes.some((c) => /^(ml|mr|pl|pr|left|right|text-left|text-right)-/.test(c))).toBe(
          false,
        );
      }
    });
  });
});
