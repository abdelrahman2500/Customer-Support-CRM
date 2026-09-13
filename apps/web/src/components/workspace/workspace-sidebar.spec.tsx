import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { WorkspaceSidebar } from "./workspace-sidebar";

/**
 * Story 129 — the `SIDEBAR` presentation, rendered only when a branch
 * admin opts into it. Every route/label/active-route/RTL case here mirrors
 * the navbar's own, deliberately: the two presentations read from one
 * `nav-items.tsx`, so a destination or rule that holds in one has to hold
 * in the other, and that is exactly what these assertions pin down.
 *
 * The collapse toggle is this presentation's own addition, and the
 * assertions on it are about the one thing a collapse must never do: lose
 * a link's accessible name.
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

const COLLAPSED_STORAGE_KEY = "crm.workspace.sidebarCollapsed";

const GROUP_KEYS = [
  "workspace",
  "ticketingConfig",
  "reporting",
  "administration",
  "system",
  "account",
] as const;

// Mirrors the deleted `workspace-nav.spec.tsx`'s own `EXPECTED_LINKS` —
// the full 20-item list, this story's permission-visibility regression
// guard in the second presentation.
const EXPECTED_LINKS: Array<[name: string, href: string]> = [
  ["nav.dashboard", "/en/dashboard"],
  ["nav.tickets", "/en/tickets"],
  ["nav.customers", "/en/customers"],
  ["nav.knowledgeBase", "/en/knowledge-base"],
  ["nav.kbCategories", "/en/kb-categories"],
  ["nav.notifications", "/en/notifications"],
  ["nav.slaPolicies", "/en/sla-policies"],
  ["nav.ticketCategories", "/en/ticket-categories"],
  ["nav.automationRules", "/en/automation-rules"],
  ["nav.quickReplies", "/en/quick-replies"],
  ["nav.reports", "/en/reports"],
  ["nav.auditLogs", "/en/audit-logs"],
  ["nav.branches", "/en/branches"],
  ["nav.users", "/en/users"],
  ["nav.roles", "/en/roles"],
  ["nav.notificationTemplates", "/en/notification-templates"],
  ["nav.webhookSubscriptions", "/en/webhook-subscriptions"],
  ["nav.apiKeys", "/en/api-keys"],
  ["nav.settings", "/en/settings"],
  ["nav.mySessions", "/en/my-sessions"],
];

function renderSidebar(props: { unreadCount?: number; unreadCountKnown?: boolean } = {}) {
  return render(
    <WorkspaceSidebar
      unreadCount={props.unreadCount ?? 0}
      unreadCountKnown={props.unreadCountKnown ?? false}
    />,
  );
}

describe("WorkspaceSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pathname = "/en/tickets";
    locale = "en";
    window.localStorage.clear();
  });

  it("labels the nav landmark with an accessible name", () => {
    renderSidebar();

    expect(screen.getByRole("navigation", { name: "nav.label" })).toBeInTheDocument();
  });

  it("renders all six group headings as real text, not just as decoration", () => {
    renderSidebar();

    const nav = screen.getByRole("navigation", { name: "nav.label" });
    for (const groupKey of GROUP_KEYS) {
      expect(within(nav).getByText(`nav.groups.${groupKey}`)).toBeInTheDocument();
    }
  });

  it("renders a link to every one of the 20 destinations, with the right hrefs", () => {
    renderSidebar();

    const nav = screen.getByRole("navigation", { name: "nav.label" });
    for (const [name, href] of EXPECTED_LINKS) {
      expect(within(nav).getByRole("link", { name }), name).toHaveAttribute("href", href);
    }
    expect(within(nav).getAllByRole("link")).toHaveLength(20);
  });

  it("no longer links branding/ai-settings/business-hours directly — settings' own tabs cover them", () => {
    renderSidebar();

    expect(screen.queryByRole("link", { name: "nav.branding" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "nav.aiSettings" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "nav.businessHours" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "nav.settings" })).toHaveAttribute(
      "href",
      "/en/settings",
    );
  });

  it("renders a decorative icon inside every link", () => {
    renderSidebar();

    const ticketsLink = screen.getByRole("link", { name: "nav.tickets" });
    const icon = ticketsLink.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute("aria-hidden");
  });

  // Story 96 — Navigation & Route Robustness.
  describe("active-route indication (Story 96)", () => {
    it("marks the current top-level route's link as the current page", () => {
      pathname = "/en/tickets";
      renderSidebar();

      expect(screen.getByRole("link", { name: "nav.tickets" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      expect(screen.getByRole("link", { name: "nav.dashboard" })).not.toHaveAttribute(
        "aria-current",
      );
    });

    it("still marks the top-level link current from a nested detail route", () => {
      pathname = "/en/tickets/ticket-1";
      renderSidebar();

      expect(screen.getByRole("link", { name: "nav.tickets" })).toHaveAttribute(
        "aria-current",
        "page",
      );
    });

    it("marks no link current on a route no nav item matches", () => {
      pathname = "/en/nowhere";
      renderSidebar();

      for (const link of screen.getAllByRole("link")) {
        expect(link).not.toHaveAttribute("aria-current");
      }
    });

    // The same reserved-border treatment the navbar and the pre-Story-129
    // nav both use: a real, non-colour cue that never shifts the row.
    it("gives the active link a visible border accent that no inactive link has", () => {
      pathname = "/en/tickets";
      renderSidebar();

      const active = screen.getByRole("link", { name: "nav.tickets" });
      const inactive = screen.getByRole("link", { name: "nav.dashboard" });
      expect(active).toHaveClass("border-accent");
      expect(inactive).toHaveClass("border-transparent");
      expect(inactive).not.toHaveClass("border-accent");
    });
  });

  // Story 92 — Notification Read-State (unread-count badge).
  describe("unread-notification badge (Story 92)", () => {
    it("renders no badge while the unread-count query is loading or erroring", () => {
      renderSidebar({ unreadCount: 0, unreadCountKnown: false });

      expect(screen.queryByLabelText(/unreadNotificationsLabel/)).not.toBeInTheDocument();
    });

    it("renders no badge when the unread count is 0", () => {
      renderSidebar({ unreadCount: 0, unreadCountKnown: true });

      expect(screen.queryByLabelText(/unreadNotificationsLabel/)).not.toBeInTheDocument();
    });

    it("renders the unread count next to the notifications link once it is positive", () => {
      renderSidebar({ unreadCount: 3, unreadCountKnown: true });

      const link = screen.getByRole("link", { name: /nav\.notifications/ });
      expect(within(link).getByLabelText(/unreadNotificationsLabel/)).toHaveTextContent("3");
    });
  });

  // Story 129 — the collapse toggle. A per-user, per-browser view
  // convenience, deliberately separate from the admin's branch-level
  // layout setting.
  describe("collapse toggle (Story 129)", () => {
    it("starts expanded, with the toggle reporting that state", () => {
      renderSidebar();

      const toggle = screen.getByRole("button", { name: "nav.collapseSidebar" });
      expect(toggle).toHaveAttribute("aria-expanded", "true");
    });

    it("flips aria-expanded and the toggle's own accessible name when clicked", async () => {
      const clickUser = userEvent.setup();
      renderSidebar();

      await clickUser.click(screen.getByRole("button", { name: "nav.collapseSidebar" }));

      const toggle = screen.getByRole("button", { name: "nav.expandSidebar" });
      expect(toggle).toHaveAttribute("aria-expanded", "false");

      await clickUser.click(toggle);
      expect(screen.getByRole("button", { name: "nav.collapseSidebar" })).toHaveAttribute(
        "aria-expanded",
        "true",
      );
    });

    // The whole point of `sr-only` over `hidden`: collapsed, the rail is
    // icon-only for a sighted user, but every link keeps its name for a
    // screen-reader or keyboard user traversing it.
    it("keeps every link's accessible name while collapsed", async () => {
      const clickUser = userEvent.setup();
      renderSidebar();

      await clickUser.click(screen.getByRole("button", { name: "nav.collapseSidebar" }));

      const nav = screen.getByRole("navigation", { name: "nav.label" });
      for (const [name, href] of EXPECTED_LINKS) {
        expect(within(nav).getByRole("link", { name }), name).toHaveAttribute("href", href);
      }
      expect(within(nav).getAllByRole("link")).toHaveLength(20);
    });

    it("keeps the group headings in the accessibility tree while collapsed", async () => {
      const clickUser = userEvent.setup();
      renderSidebar();

      await clickUser.click(screen.getByRole("button", { name: "nav.collapseSidebar" }));

      const nav = screen.getByRole("navigation", { name: "nav.label" });
      for (const groupKey of GROUP_KEYS) {
        expect(within(nav).getByText(`nav.groups.${groupKey}`)).toBeInTheDocument();
      }
    });

    it("still marks the active link current while collapsed", async () => {
      const clickUser = userEvent.setup();
      pathname = "/en/tickets";
      renderSidebar();

      await clickUser.click(screen.getByRole("button", { name: "nav.collapseSidebar" }));

      expect(screen.getByRole("link", { name: "nav.tickets" })).toHaveAttribute(
        "aria-current",
        "page",
      );
    });

    it("persists the collapsed flag to localStorage", async () => {
      const clickUser = userEvent.setup();
      renderSidebar();

      await clickUser.click(screen.getByRole("button", { name: "nav.collapseSidebar" }));
      expect(window.localStorage.getItem(COLLAPSED_STORAGE_KEY)).toBe("true");

      await clickUser.click(screen.getByRole("button", { name: "nav.expandSidebar" }));
      expect(window.localStorage.getItem(COLLAPSED_STORAGE_KEY)).toBe("false");
    });

    it("restores the collapsed flag from localStorage on a fresh mount", async () => {
      window.localStorage.setItem(COLLAPSED_STORAGE_KEY, "true");

      renderSidebar();

      expect(await screen.findByRole("button", { name: "nav.expandSidebar" })).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    });

    // `localStorage` is never read during render: the server renders this
    // component too, and a value only the browser has would make the first
    // client render disagree with the server's HTML — a hydration
    // mismatch. Server-rendering it with a collapsed flag already in
    // storage is the direct proof: the markup must still be the expanded
    // default, which is exactly what the client's first render produces.
    it("server-renders the expanded default even when storage already says collapsed", () => {
      window.localStorage.setItem(COLLAPSED_STORAGE_KEY, "true");

      const html = renderToString(<WorkspaceSidebar unreadCount={0} unreadCountKnown={false} />);

      expect(html).toContain('aria-expanded="true"');
      expect(html).toContain("w-60");
      expect(html).not.toContain("w-16");
    });
  });

  describe("RTL and i18n", () => {
    it("keeps the active locale segment on every link under /ar", () => {
      locale = "ar";
      pathname = "/ar/tickets";
      renderSidebar();

      const nav = screen.getByRole("navigation", { name: "nav.label" });
      for (const [name, href] of EXPECTED_LINKS) {
        const arabicHref = href.replace("/en/", "/ar/");
        expect(within(nav).getByRole("link", { name }), name).toHaveAttribute("href", arabicHref);
        expect(arabicHref.startsWith("/ar/ar")).toBe(false);
      }
    });

    // Workspace Navigation UX audit — RTL regression guard, re-homed and
    // extended to the rail itself. A sidebar is precisely where a physical
    // `border-r`/`pl-`/`left-` leaks in, which
    // `docs/architecture/12-risks-tradeoffs-and-scope.md`'s risk #1 forbids.
    it("uses only logical-direction classes on every link", () => {
      renderSidebar();

      const nav = screen.getByRole("navigation", { name: "nav.label" });
      for (const link of within(nav).getAllByRole("link")) {
        const classes = link.className.split(/\s+/);
        expect(classes.some((c) => c.startsWith("border-s-") || c === "border-transparent")).toBe(
          true,
        );
        expect(classes.some((c) => /^border-[lr]-/.test(c))).toBe(false);
        expect(classes.some((c) => /^(ml|mr|pl|pr|left|right|text-left|text-right)-/.test(c))).toBe(
          false,
        );
      }
    });

    it("borders the rail itself on the logical end edge, never a physical right edge", () => {
      const { container } = renderSidebar();

      const aside = container.querySelector("aside");
      expect(aside).not.toBeNull();
      const classes = (aside as HTMLElement).className.split(/\s+/);
      expect(classes).toContain("border-e");
      expect(classes.some((c) => /^border-[lr]\b|^border-[lr]-/.test(c))).toBe(false);
    });
  });
});
