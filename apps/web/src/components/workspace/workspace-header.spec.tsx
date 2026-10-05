import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkspaceHeader } from "./workspace-header";
import { useMyBranchMembershipsQuery } from "@/hooks/use-branch-memberships";
import { useMentionNotifications } from "@/hooks/use-mention-notifications";
import { ApiError, clearAccessToken, logout, switchBranch, updatePreferredLocale } from "@/lib/api";
import { clearQueryCache } from "@/lib/query-client-registry";
import { useRealtimeConnectionIssue } from "@/lib/realtime-connection";
import type { BrandingSummary } from "@/lib/branding-api";

/**
 * Story 129 — every case in this file was re-homed verbatim from the
 * deleted `workspace-nav.spec.tsx`, which covered the header and the
 * navigation in one file because they lived in one component. The header's
 * own behaviour (sign-out, branch switching, locale switching, the
 * realtime banner, the brand block, the RM-11 hamburger) is unchanged by
 * that split and is asserted here exactly as it was there. The navigation
 * cases moved to `workspace-navbar.spec.tsx`/`workspace-sidebar.spec.tsx`.
 *
 * New here: Story 129's `appName` override and its whitespace fallback.
 *
 * The mock block below is `workspace-nav.spec.tsx`'s own, reused verbatim
 * minus the two hooks the header no longer calls — `useBrandingQuery` and
 * `useUnreadNotificationCountQuery` are now `WorkspaceShell`'s single
 * queries, handed down as props.
 */
const push = vi.fn();
const refresh = vi.fn();
let pathname = "/en/tickets";
// Story S-6 — mutable so a test can render under `/ar`, mirroring how
// `pathname` above is already varied per test.
let locale = "en";

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale }),
  useRouter: () => ({ push, refresh }),
  usePathname: () => pathname,
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
}));

// A11Y/NAV-1 — spreads the real module (keeping the real `ApiError` class,
// needed for `classifyError`'s `instanceof` check in the branch-switch
// rejection tests below) and overrides only the four functions this
// component calls, mirroring this codebase's established partial-mock
// convention for exactly this situation.
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  logout: vi.fn(),
  clearAccessToken: vi.fn(),
  switchBranch: vi.fn(),
  updatePreferredLocale: vi.fn(),
}));

// Story 95 — Authentication Recovery.
vi.mock("@/lib/query-client-registry", () => ({
  clearQueryCache: vi.fn(),
}));

// Story 118 — Branch switcher.
vi.mock("@/hooks/use-branch-memberships", () => ({
  useMyBranchMembershipsQuery: vi.fn(),
}));

// RM-06 — mounted here unconditionally; its own behavior is covered by its
// own dedicated spec, so this file only needs it to be a real no-op (it
// calls the real `useQueryClient()` otherwise, which throws without a
// `QueryClientProvider` this file never sets up).
vi.mock("@/hooks/use-mention-notifications", () => ({
  useMentionNotifications: vi.fn(),
}));

// Batch 7 (UX audit) — the shared connection's own behavior is covered by
// its dedicated `realtime-connection.spec.ts`; this file only needs to
// drive the banner's own on/off rendering.
vi.mock("@/lib/realtime-connection", () => ({
  useRealtimeConnectionIssue: vi.fn(() => false),
}));

const mockedLogout = vi.mocked(logout);
const mockedClearAccessToken = vi.mocked(clearAccessToken);
const mockedSwitchBranch = vi.mocked(switchBranch);
const mockedUpdatePreferredLocale = vi.mocked(updatePreferredLocale);
const mockedClearQueryCache = vi.mocked(clearQueryCache);
const mockedUseMyBranchMembershipsQuery = vi.mocked(useMyBranchMembershipsQuery);
const mockedUseRealtimeConnectionIssue = vi.mocked(useRealtimeConnectionIssue);

const user = {
  id: "user-1",
  email: "agent@example.com",
  fullName: "Ada Lovelace",
  branchId: "branch-1",
  departmentId: null,
  roles: ["Agent"],
  preferredLocale: null,
};

function branding(overrides: Partial<BrandingSummary> = {}): BrandingSummary {
  return {
    appName: null,
    logoUrl: null,
    primaryColor: null,
    secondaryColor: null,
    navigationLayout: null,
    ...overrides,
  };
}

function renderHeader(
  props: Partial<{
    branding: BrandingSummary | undefined;
    unreadCount: number;
    unreadCountKnown: boolean;
  }> = {},
) {
  return render(
    <WorkspaceHeader
      user={user}
      branding={props.branding}
      unreadCount={props.unreadCount ?? 0}
      unreadCountKnown={props.unreadCountKnown ?? false}
    />,
  );
}

/** Story 195 (RD-2.1) — the identity, branch switcher, language, theme,
 * My sessions, Settings and Sign out live in the user menu now, so a test
 * that drives one of them opens the menu first. The behaviour under test is
 * unchanged. */
const userMenuTriggerName = `userMenu.trigger:${JSON.stringify({ name: user.fullName })}`;
function openUserMenu() {
  fireEvent.click(screen.getByRole("button", { name: userMenuTriggerName }));
}

describe("WorkspaceHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pathname = "/en/tickets";
    mockedLogout.mockResolvedValue(undefined);
    // Story 118 — a single membership (the common case for every user
    // before this story) hides the switcher entirely; tests that need
    // more than one override this explicitly.
    mockedUseMyBranchMembershipsQuery.mockReturnValue({
      data: [
        {
          branchId: "branch-1",
          branchName: "Main Branch",
          departmentId: null,
          departmentName: null,
          roleId: "role-1",
          roleName: "Agent",
          isActive: true,
        },
      ],
    } as never);
    mockedUpdatePreferredLocale.mockResolvedValue({ id: "user-1" });
    mockedUseRealtimeConnectionIssue.mockReturnValue(false);
  });

  it("renders the app name and the signed-in user's name", () => {
    renderHeader();
    openUserMenu();

    expect(screen.getByText("appName")).toBeInTheDocument();
    expect(
      screen.getByText(`signedInAs:${JSON.stringify({ name: user.fullName })}`),
    ).toBeInTheDocument();
  });

  // RM-06 — mounted here so a mention notifies the agent regardless of
  // which page is open, not just while a specific dashboard panel is
  // mounted (mirrors the always-on unread-count badge).
  it("joins the signed-in user's own mention-notifications room", () => {
    renderHeader();

    expect(useMentionNotifications).toHaveBeenCalledWith(user.id);
  });

  it("calls the real logout, then clears the local token and query cache, and redirects to login, on sign-out", async () => {
    renderHeader();
    openUserMenu();

    fireEvent.click(screen.getByText("signOut"));

    await waitFor(() => expect(mockedLogout).toHaveBeenCalledOnce());
    expect(mockedClearAccessToken).toHaveBeenCalledOnce();
    // Story 95 — a different user signing in next must never see this
    // session's cached data flash before their own queries refetch.
    expect(mockedClearQueryCache).toHaveBeenCalledOnce();
    expect(push).toHaveBeenCalledWith("/en/login");
  });

  it("still clears the local token and redirects even when the logout call rejects", async () => {
    mockedLogout.mockRejectedValue(new Error("network down"));

    renderHeader();
    openUserMenu();

    fireEvent.click(screen.getByText("signOut"));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/en/login"));
    expect(mockedClearAccessToken).toHaveBeenCalledOnce();
  });

  it("awaits logout before clearing the local token and redirecting, not fire-and-forget", async () => {
    let resolveLogout!: () => void;
    mockedLogout.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveLogout = resolve;
      }),
    );

    renderHeader();
    openUserMenu();
    fireEvent.click(screen.getByText("signOut"));

    // Let any already-queued microtasks run while the logout promise is
    // still pending — cleanup/redirect must not have happened yet.
    await Promise.resolve();
    await Promise.resolve();
    expect(mockedClearAccessToken).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();

    resolveLogout();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/en/login"));
    expect(mockedClearAccessToken).toHaveBeenCalledOnce();
  });

  it("still renders the app-name link and sign-out button unchanged, alongside the signed-in text", () => {
    renderHeader();
    openUserMenu();

    expect(screen.getByRole("link", { name: "appName" })).toHaveAttribute("href", "/en/tickets");
    expect(screen.getByRole("button", { name: "signOut" })).toBeInTheDocument();
    expect(
      screen.getByText(`signedInAs:${JSON.stringify({ name: user.fullName })}`),
    ).toBeInTheDocument();
  });

  it("keeps the active locale segment on the brand/home link under /ar", () => {
    locale = "ar";
    pathname = "/ar/tickets";
    try {
      renderHeader();

      expect(screen.getByRole("link", { name: "appName" })).toHaveAttribute("href", "/ar/tickets");
    } finally {
      locale = "en";
      pathname = "/en/tickets";
    }
  });

  // Story 82 — Branding — Live Logo/Color Consumption.
  describe("branding consumption (Story 82)", () => {
    it("renders the plain app-name text link when no branding is configured", () => {
      renderHeader({ branding: branding() });

      expect(screen.getByRole("link", { name: "appName" })).toHaveAttribute("href", "/en/tickets");
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });

    it("renders the branch logo instead of the app-name text link once one is configured", () => {
      renderHeader({ branding: branding({ logoUrl: "https://example.com/logo.png" }) });

      expect(screen.getByRole("img", { name: "appName" })).toHaveAttribute(
        "src",
        "https://example.com/logo.png",
      );
      expect(screen.queryByRole("link", { name: "appName" })).not.toBeInTheDocument();
    });

    // Story 183 (RD-1.6) — the header no longer owns an ad-hoc
    // `--brand-primary`; its edge reads the `--brand` token, which
    // WorkspaceShell's BrandScope sets from the branch (see its spec).
    it("draws its bottom edge from the brand token, with or without branding", () => {
      const { unmount } = renderHeader();
      expect(screen.getByRole("banner")).toHaveClass("border-brand");
      expect(screen.getByRole("banner").getAttribute("style")).toBeNull();
      unmount();

      renderHeader({ branding: branding({ primaryColor: "#112233" }) });
      expect(screen.getByRole("banner")).toHaveClass("border-brand");
    });
  });

  // Story 129 — Admin Branding & Navigation Layout Customization.
  describe("configured application name (Story 129)", () => {
    it("renders the branch's configured appName in place of the translated default", () => {
      renderHeader({ branding: branding({ appName: "Acme Support" }) });

      expect(screen.getByRole("link", { name: "Acme Support" })).toHaveAttribute(
        "href",
        "/en/tickets",
      );
      expect(screen.queryByText("appName")).not.toBeInTheDocument();
    });

    it("falls back to the translated default when appName is null", () => {
      renderHeader({ branding: branding({ appName: null }) });

      expect(screen.getByRole("link", { name: "appName" })).toBeInTheDocument();
    });

    // `?.trim() ||`, not `??` — a `??` would print a blank brand block.
    it("falls back to the translated default when appName is whitespace only", () => {
      renderHeader({ branding: branding({ appName: "   " }) });

      expect(screen.getByRole("link", { name: "appName" })).toBeInTheDocument();
    });

    it("falls back to the translated default while branding has not resolved at all", () => {
      renderHeader({ branding: undefined });

      expect(screen.getByRole("link", { name: "appName" })).toBeInTheDocument();
    });

    it("uses the configured appName as the logo's alt text too", () => {
      renderHeader({
        branding: branding({ appName: "Acme Support", logoUrl: "https://example.com/logo.png" }),
      });

      expect(screen.getByRole("img", { name: "Acme Support" })).toHaveAttribute(
        "src",
        "https://example.com/logo.png",
      );
    });
  });

  // RM-11 — Mobile-Responsive Navigation. Story 129 — one hamburger now
  // serves both desktop presentations, so it lives here in the header.
  // Story 213 (PR-2.1) — below sm the hamburger opens a drawer (a Sheet
  // dialog named by the menu label) holding the same grouped links as the
  // rail, instead of a dropdown menu; so these find a dialog of links.
  describe("collapsed mobile menu (RM-11)", () => {
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

    it("renders a menu toggle with an accessible name", () => {
      renderHeader();

      expect(screen.getByRole("button", { name: "nav.menuLabel" })).toBeInTheDocument();
    });

    it("opens a real menu, with every nav item reachable inside it, once the toggle is clicked", async () => {
      const clickUser = userEvent.setup();
      renderHeader();

      await clickUser.click(screen.getByRole("button", { name: "nav.menuLabel" }));

      const menu = await screen.findByRole("dialog", { name: "nav.menuLabel" });
      for (const [name, href] of EXPECTED_LINKS) {
        expect(within(menu).getByRole("link", { name })).toHaveAttribute("href", href);
      }
    });

    // Batch 3 (UX audit) — the 23-item flat list is now six named sections.
    it("labels each section of the menu, mirroring the desktop nav's grouping", async () => {
      const clickUser = userEvent.setup();
      renderHeader();

      await clickUser.click(screen.getByRole("button", { name: "nav.menuLabel" }));
      const menu = await screen.findByRole("dialog", { name: "nav.menuLabel" });

      // Story 213 (PD-10) — the regrouped navigation.
      for (const groupKey of ["work", "insights", "configure", "admin", "account"]) {
        expect(within(menu).getByText(`nav.groups.${groupKey}`)).toBeInTheDocument();
      }
    });

    // Batch 3 (UX audit) — RM-23's Settings consolidation left `branding`,
    // `ai-settings` and `business-hours` as duplicate top-level nav entries
    // alongside the `settings` screen that already embeds all three as
    // tabs. Their routes are untouched (a direct link/bookmark still
    // works); only the redundant nav entries are gone.
    it("no longer links branding/ai-settings/business-hours directly — settings' own tabs cover them", async () => {
      const clickUser = userEvent.setup();
      renderHeader();

      await clickUser.click(screen.getByRole("button", { name: "nav.menuLabel" }));
      const menu = await screen.findByRole("dialog", { name: "nav.menuLabel" });

      expect(within(menu).queryByRole("link", { name: "nav.branding" })).not.toBeInTheDocument();
      expect(
        within(menu).queryByRole("link", { name: "nav.aiSettings" }),
      ).not.toBeInTheDocument();
      expect(
        within(menu).queryByRole("link", { name: "nav.businessHours" }),
      ).not.toBeInTheDocument();
      expect(within(menu).getByRole("link", { name: "nav.settings" })).toHaveAttribute(
        "href",
        "/en/settings",
      );
    });

    it("marks the current top-level route's menu item current, mirroring the desktop nav", async () => {
      const clickUser = userEvent.setup();
      pathname = "/en/tickets";
      renderHeader();

      await clickUser.click(screen.getByRole("button", { name: "nav.menuLabel" }));
      const menu = await screen.findByRole("dialog", { name: "nav.menuLabel" });

      expect(within(menu).getByRole("link", { name: "nav.tickets" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      expect(within(menu).getByRole("link", { name: "nav.dashboard" })).not.toHaveAttribute(
        "aria-current",
      );
    });

    it("still marks the top-level menu item current from a nested detail route", async () => {
      const clickUser = userEvent.setup();
      pathname = "/en/tickets/ticket-1";
      renderHeader();

      await clickUser.click(screen.getByRole("button", { name: "nav.menuLabel" }));
      const menu = await screen.findByRole("dialog", { name: "nav.menuLabel" });

      expect(within(menu).getByRole("link", { name: "nav.tickets" })).toHaveAttribute(
        "aria-current",
        "page",
      );
    });

    it("keeps the active locale segment on every menu item under /ar, mirroring the desktop nav", async () => {
      const clickUser = userEvent.setup();
      locale = "ar";
      pathname = "/ar/tickets";
      try {
        renderHeader();

        await clickUser.click(screen.getByRole("button", { name: "nav.menuLabel" }));
        const menu = await screen.findByRole("dialog", { name: "nav.menuLabel" });

        for (const [name, href] of EXPECTED_LINKS) {
          const arabicHref = href.replace("/en/", "/ar/");
          expect(within(menu).getByRole("link", { name }), name).toHaveAttribute(
            "href",
            arabicHref,
          );
          expect(arabicHref.startsWith("/ar/ar")).toBe(false);
        }
      } finally {
        locale = "en";
        pathname = "/en/tickets";
      }
    });

    it("shows the unread-count badge on the menu's own notifications item too", async () => {
      const clickUser = userEvent.setup();
      renderHeader({ unreadCount: 3, unreadCountKnown: true });

      await clickUser.click(screen.getByRole("button", { name: "nav.menuLabel" }));
      const menu = await screen.findByRole("dialog", { name: "nav.menuLabel" });

      expect(within(menu).getByLabelText(/unreadNotificationsLabel/)).toHaveTextContent("3");
    });

    it("renders no badge in the menu while the unread count is unknown or zero", async () => {
      const clickUser = userEvent.setup();
      renderHeader({ unreadCount: 0, unreadCountKnown: true });

      await clickUser.click(screen.getByRole("button", { name: "nav.menuLabel" }));
      const menu = await screen.findByRole("dialog", { name: "nav.menuLabel" });

      expect(within(menu).queryByLabelText(/unreadNotificationsLabel/)).not.toBeInTheDocument();
    });
  });

  // Story 118 — Identity & Access: Multi-branch assignment + branch switching.
  describe("branch switcher (Story 118)", () => {
    const singleMembership = [
      {
        branchId: "branch-1",
        branchName: "Main Branch",
        departmentId: null,
        departmentName: null,
        roleId: "role-1",
        roleName: "Agent",
        isActive: true,
      },
    ];
    const twoMemberships = [
      ...singleMembership,
      {
        branchId: "branch-2",
        branchName: "Second Branch",
        departmentId: null,
        departmentName: null,
        roleId: "role-2",
        roleName: "Agent",
        isActive: false,
      },
    ];

    it("renders no switcher for a user with only one membership", () => {
      renderHeader();
      openUserMenu();

      expect(screen.queryByLabelText("branchSwitcher.label")).not.toBeInTheDocument();
    });

    it("renders a switcher, pre-selecting the currently active membership, once there is more than one", () => {
      mockedUseMyBranchMembershipsQuery.mockReturnValue({ data: twoMemberships } as never);

      renderHeader();
      openUserMenu();

      const select = screen.getByLabelText("branchSwitcher.label") as HTMLSelectElement;
      expect(select).toHaveValue("branch-1::");
      expect(screen.getByText("Main Branch")).toBeInTheDocument();
      expect(screen.getByText("Second Branch")).toBeInTheDocument();
    });

    it("switches branch, clears the query cache, and refreshes the current route", async () => {
      mockedUseMyBranchMembershipsQuery.mockReturnValue({ data: twoMemberships } as never);
      mockedSwitchBranch.mockResolvedValue("new-access-token");

      renderHeader();
      openUserMenu();
      fireEvent.change(screen.getByLabelText("branchSwitcher.label"), {
        target: { value: "branch-2::" },
      });

      await waitFor(() => expect(mockedSwitchBranch).toHaveBeenCalledWith("branch-2", undefined));
      expect(mockedClearQueryCache).toHaveBeenCalledOnce();
      expect(refresh).toHaveBeenCalledOnce();
    });

    it("passes departmentId through when the target membership has one", async () => {
      mockedUseMyBranchMembershipsQuery.mockReturnValue({
        data: [
          ...singleMembership,
          {
            branchId: "branch-2",
            branchName: "Second Branch",
            departmentId: "dept-2",
            departmentName: "Support",
            roleId: "role-2",
            roleName: "Agent",
            isActive: false,
          },
        ],
      } as never);
      mockedSwitchBranch.mockResolvedValue("new-access-token");

      renderHeader();
      openUserMenu();
      fireEvent.change(screen.getByLabelText("branchSwitcher.label"), {
        target: { value: "branch-2::dept-2" },
      });

      await waitFor(() => expect(mockedSwitchBranch).toHaveBeenCalledWith("branch-2", "dept-2"));
    });

    // NAV-1 — unlike handleSignOut/handleSwitchLocale, a rejected
    // switchBranch must not silently clear the cache/refresh as if it had
    // succeeded.
    it("shows a forbidden-specific message and does not clear the cache or refresh when rejected with 403", async () => {
      mockedUseMyBranchMembershipsQuery.mockReturnValue({ data: twoMemberships } as never);
      mockedSwitchBranch.mockRejectedValue(new ApiError("Forbidden", 403));

      renderHeader();
      openUserMenu();
      fireEvent.change(screen.getByLabelText("branchSwitcher.label"), {
        target: { value: "branch-2::" },
      });

      expect(await screen.findByRole("alert")).toHaveTextContent("branchSwitcher.actionForbidden");
      expect(mockedClearQueryCache).not.toHaveBeenCalled();
      expect(refresh).not.toHaveBeenCalled();
    });

    it("shows a generic message when rejected with a non-403 error", async () => {
      mockedUseMyBranchMembershipsQuery.mockReturnValue({ data: twoMemberships } as never);
      mockedSwitchBranch.mockRejectedValue(new ApiError("Server error", 500));

      renderHeader();
      openUserMenu();
      fireEvent.change(screen.getByLabelText("branchSwitcher.label"), {
        target: { value: "branch-2::" },
      });

      expect(await screen.findByRole("alert")).toHaveTextContent("branchSwitcher.actionFailed");
    });

    it("clears a previous error and succeeds on a subsequent, successful switch", async () => {
      mockedUseMyBranchMembershipsQuery.mockReturnValue({ data: twoMemberships } as never);
      mockedSwitchBranch.mockRejectedValueOnce(new ApiError("Server error", 500));

      renderHeader();
      openUserMenu();
      const select = screen.getByLabelText("branchSwitcher.label");
      fireEvent.change(select, { target: { value: "branch-2::" } });
      await screen.findByRole("alert");

      mockedSwitchBranch.mockResolvedValue("new-access-token");
      fireEvent.change(select, { target: { value: "branch-2::" } });

      await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  /**
   * Story 173 — the header overflowed a 320px viewport (measured against a
   * real build: 354px EN, 367px AR) because it was a single non-wrapping
   * flex row. RM-10/RM-11 made both navigation surfaces responsive and
   * never returned for this row.
   *
   * These are class-level assertions on purpose. jsdom loads no Tailwind
   * CSS, so a `scrollWidth` assertion here returns the same value before
   * and after the fix — it would pass against the bug. The repository has
   * already hit and recorded this exact limit twice (`packages/ui/src/lib/
   * cn.spec.ts`, and Story 169's `Button` guard) and resolved it the same
   * way: pin the mechanism here, prove the behaviour in a browser.
   */
  describe("responsive header (Story 173)", () => {
    /** The same two-membership shape `describe("branch switcher (Story 118)")`
     * uses; duplicated rather than lifted so none of its tests is touched. */
    const twoMemberships = [
      {
        branchId: "branch-1",
        branchName: "Main Branch",
        departmentId: null,
        departmentName: null,
        roleId: "role-1",
        roleName: "Agent",
        isActive: true,
      },
      {
        branchId: "branch-2",
        branchName: "Second Branch",
        departmentId: null,
        departmentName: null,
        roleId: "role-2",
        roleName: "Agent",
        isActive: false,
      },
    ];

    /**
     * Story 195 (RD-2.1) — header v2 replaces Story 173's wrapping rows with a
     * single row that fits 320px by construction: the user's controls moved
     * into the user menu, and the brand is the one elastic item. The
     * mechanism is pinned here; the 320px behaviour is proven in a browser.
     */
    it("keeps the header to one row whose brand is the only elastic item", () => {
      const { container } = renderHeader();

      const header = container.querySelector("header")!;
      expect(header).toHaveClass("flex", "items-center");
      expect(header).not.toHaveClass("flex-wrap");
      const brandLink = screen.getByRole("link", { name: "appName" });
      expect(brandLink).toHaveClass("min-w-0", "truncate");
      expect(brandLink.parentElement).toHaveClass("min-w-0", "flex-1");
    });

    /** Both classes asserted together — `truncate` without `min-w-0` raises
     * the item's automatic minimum width to the whole string. */
    it("makes the signed-in identity in the user menu the elastic, truncatable item", () => {
      renderHeader();
      openUserMenu();

      const identity = screen.getByText(`signedInAs:${JSON.stringify({ name: user.fullName })}`);
      expect(identity).toHaveClass("min-w-0");
      expect(identity).toHaveClass("truncate");
    });

    it("bounds the brand logo below sm only, leaving its desktop sizing natural", () => {
      const { container } = renderHeader({
        branding: branding({ logoUrl: "https://example.com/logo.png" }),
      });

      const logo = container.querySelector("img")!;
      expect(logo).toHaveClass("max-w-32");
      expect(logo).toHaveClass("object-contain");
      expect(logo).toHaveClass("sm:max-w-none");
      // The existing sizing is kept.
      expect(logo).toHaveClass("h-8");
      expect(logo).toHaveClass("w-auto");
    });

    /**
     * The test that catches a "fix" implemented by hiding controls. Every
     * control stays in the document in the widest configuration, and none of
     * them — nor the cluster — is display-toggled by a `hidden` class.
     */
    it("keeps every control present in the multi-membership case, hiding nothing", () => {
      mockedUseMyBranchMembershipsQuery.mockReturnValue({ data: twoMemberships } as never);

      renderHeader();
      const trigger = screen.getByRole("button", { name: userMenuTriggerName });
      const newTicket = screen.getByRole("link", { name: "header.newTicket" });
      const bell = screen.getByRole("link", { name: "header.notifications" });
      openUserMenu();

      const identity = screen.getByText(`signedInAs:${JSON.stringify({ name: user.fullName })}`);
      const branchSwitcher = screen.getByLabelText("branchSwitcher.label");
      const languageSwitcher = screen.getByLabelText("languageSwitcher.label");
      const themeSwitcher = screen.getByLabelText("themeSwitcher.label");
      const signOut = screen.getByRole("button", { name: "signOut" });

      for (const control of [
        trigger,
        newTicket,
        bell,
        identity,
        branchSwitcher,
        languageSwitcher,
        themeSwitcher,
        signOut,
      ]) {
        expect(control).toBeInTheDocument();
        expect(control.className.split(/\s+/)).not.toContain("hidden");
      }
    });

    /**
     * RTL regression guard, mirroring `workspace-sidebar.spec.tsx`'s own —
     * `docs/architecture/12-risks-tradeoffs-and-scope.md`'s risk #1 forbids
     * physical-direction utilities, and a wrapping row is exactly where a
     * stray `mr-`/`pl-` would leak in.
     */
    it("uses only logical-direction classes across the header subtree", () => {
      mockedUseMyBranchMembershipsQuery.mockReturnValue({ data: twoMemberships } as never);

      const { container } = renderHeader({
        branding: branding({ logoUrl: "https://example.com/logo.png" }),
      });

      openUserMenu();
      const header = container.querySelector("header")!;
      const menu = screen.getByRole("dialog");
      for (const element of [
        header,
        ...header.querySelectorAll("[class]"),
        ...menu.querySelectorAll("[class]"),
      ]) {
        const classes = element.className.toString().split(/\s+/);
        expect(classes.some((c) => /^(ml|mr|pl|pr|left|right|text-left|text-right)-/.test(c))).toBe(
          false,
        );
        expect(classes.some((c) => /^border-[lr]-/.test(c))).toBe(false);
      }
    });
  });

  // Story 195 (RD-2.1) — header v2: New ticket, the notifications bell and
  // the user menu.
  describe("header v2 (Story 195)", () => {
    it("links New ticket to the create page under the active locale", () => {
      const { unmount } = renderHeader();
      expect(screen.getByRole("link", { name: "header.newTicket" })).toHaveAttribute(
        "href",
        "/en/tickets/new",
      );
      unmount();

      locale = "ar";
      try {
        renderHeader();
        expect(screen.getByRole("link", { name: "header.newTicket" })).toHaveAttribute(
          "href",
          "/ar/tickets/new",
        );
      } finally {
        locale = "en";
      }
    });

    it("names the notifications bell without a count while it is unknown or zero", () => {
      const { unmount } = renderHeader({ unreadCount: 4, unreadCountKnown: false });
      expect(screen.getByRole("link", { name: "header.notifications" })).toHaveAttribute(
        "href",
        "/en/notifications",
      );
      unmount();

      renderHeader({ unreadCount: 0, unreadCountKnown: true });
      expect(screen.getByRole("link", { name: "header.notifications" })).toBeInTheDocument();
    });

    it("puts the unread count in the bell's accessible name and hides the visual badge from assistive tech", () => {
      renderHeader({ unreadCount: 3, unreadCountKnown: true });

      const bell = screen.getByRole("link", {
        name: `header.notificationsUnread:${JSON.stringify({ count: 3 })}`,
      });
      const badge = within(bell).getByText("3");
      expect(badge).toHaveAttribute("aria-hidden", "true");
    });

    it("caps the visual count at 99+", () => {
      renderHeader({ unreadCount: 120, unreadCountKnown: true });

      expect(screen.getByText("99+")).toHaveAttribute("aria-hidden", "true");
    });

    it("opens a labelled account menu holding every account control and link", () => {
      renderHeader();
      openUserMenu();

      const menu = screen.getByRole("dialog", { name: "userMenu.label" });
      expect(within(menu).getByLabelText("languageSwitcher.label")).toBeInTheDocument();
      expect(within(menu).getByLabelText("themeSwitcher.label")).toBeInTheDocument();
      expect(within(menu).getByRole("button", { name: "signOut" })).toBeInTheDocument();
      expect(within(menu).getByRole("link", { name: "nav.mySessions" })).toHaveAttribute(
        "href",
        "/en/my-sessions",
      );
      expect(within(menu).getByRole("link", { name: "nav.settings" })).toHaveAttribute(
        "href",
        "/en/settings",
      );
    });

    it("closes the account menu on Escape and returns focus to its trigger", async () => {
      const ue = userEvent.setup();
      renderHeader();

      const trigger = screen.getByRole("button", { name: userMenuTriggerName });
      await ue.click(trigger);
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      await ue.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(trigger).toHaveFocus();
    });

    it("puts the hamburger in the header row (NAV-04)", () => {
      const { container } = renderHeader();

      const toggle = screen.getByRole("button", { name: "nav.menuLabel" });
      expect(container.querySelector("header")).toContainElement(toggle);
    });
  });

  // Story 119 — i18n/RTL: Persisted locale preference + language switcher.
  describe("language switcher (Story 119)", () => {
    it("renders a switcher pre-selecting the current URL locale", () => {
      renderHeader();
      openUserMenu();

      expect(screen.getByLabelText("languageSwitcher.label")).toHaveValue("en");
    });

    it("persists the new locale and navigates to the same page under the new locale segment", async () => {
      renderHeader();
      openUserMenu();

      fireEvent.change(screen.getByLabelText("languageSwitcher.label"), {
        target: { value: "ar" },
      });

      await waitFor(() => expect(mockedUpdatePreferredLocale).toHaveBeenCalledWith("ar"));
      expect(push).toHaveBeenCalledWith("/ar/tickets");
    });

    it("still navigates when persisting the preference rejects", async () => {
      mockedUpdatePreferredLocale.mockRejectedValue(new Error("network down"));

      renderHeader();
      openUserMenu();
      fireEvent.change(screen.getByLabelText("languageSwitcher.label"), {
        target: { value: "ar" },
      });

      await waitFor(() => expect(push).toHaveBeenCalledWith("/ar/tickets"));
    });

    it("does nothing when re-selecting the already-active locale", async () => {
      renderHeader();
      openUserMenu();

      fireEvent.change(screen.getByLabelText("languageSwitcher.label"), {
        target: { value: "en" },
      });

      await Promise.resolve();
      expect(mockedUpdatePreferredLocale).not.toHaveBeenCalled();
      expect(push).not.toHaveBeenCalled();
    });

    it("preserves a nested path when switching locale", async () => {
      pathname = "/en/tickets/ticket-1";

      renderHeader();
      openUserMenu();
      fireEvent.change(screen.getByLabelText("languageSwitcher.label"), {
        target: { value: "ar" },
      });

      await waitFor(() => expect(push).toHaveBeenCalledWith("/ar/tickets/ticket-1"));
    });
  });

  // Batch 7 (UX audit) — no realtime hook anywhere previously surfaced a
  // dropped connection to the user at all.
  describe("realtime connection banner (Batch 7)", () => {
    it("shows nothing while the shared connection is fine", () => {
      renderHeader();

      expect(screen.queryByText("realtimeReconnecting")).not.toBeInTheDocument();
    });

    it("shows a non-destructive reconnecting banner once the shared connection reports an issue", () => {
      mockedUseRealtimeConnectionIssue.mockReturnValue(true);

      renderHeader();

      expect(screen.getByText("realtimeReconnecting")).toBeInTheDocument();
    });
  });

  // Story 213 (PR-2.1) — the ink chrome band and the mobile drawer.
  describe("shell v2 (Story 213)", () => {
    it("is the ink chrome band with the brand edge, and its quiet actions use the chrome variant", () => {
      renderHeader();
      const banner = screen.getByRole("banner");
      expect(banner).toHaveClass("bg-chrome", "on-chrome", "border-brand");
      expect(screen.getByRole("button", { name: "nav.menuLabel" })).toHaveClass("text-chrome-muted");
    });

    it("opens the drawer from the reading side and closes it when a route is chosen", async () => {
      const clickUser = userEvent.setup();
      renderHeader();

      await clickUser.click(screen.getByRole("button", { name: "nav.menuLabel" }));
      const drawer = await screen.findByRole("dialog", { name: "nav.menuLabel" });
      expect(drawer).toHaveAttribute("data-side", "start");
      expect(within(drawer).getByRole("navigation", { name: "nav.label" })).toBeInTheDocument();

      await clickUser.click(within(drawer).getByRole("link", { name: "nav.tickets" }));
      await vi.waitFor(() =>
        expect(screen.queryByRole("dialog", { name: "nav.menuLabel" })).not.toBeInTheDocument(),
      );
    });

    it("closes the drawer with its named close button", async () => {
      const clickUser = userEvent.setup();
      renderHeader();
      await clickUser.click(screen.getByRole("button", { name: "nav.menuLabel" }));
      await clickUser.click(await screen.findByRole("button", { name: "nav.closeMenu" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
