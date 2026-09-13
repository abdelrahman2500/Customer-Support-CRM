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

    it("leaves the header's brand-primary CSS variable unset when no branding is configured", () => {
      renderHeader();

      const header = screen.getByRole("banner");
      expect(header.style.getPropertyValue("--brand-primary")).toBe("");
    });

    it("sets the header's brand-primary CSS variable once a primaryColor is configured", () => {
      renderHeader({ branding: branding({ primaryColor: "#112233" }) });

      const header = screen.getByRole("banner");
      expect(header.style.getPropertyValue("--brand-primary")).toBe("#112233");
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

      const menu = await screen.findByRole("menu");
      for (const [name, href] of EXPECTED_LINKS) {
        expect(within(menu).getByRole("menuitem", { name })).toHaveAttribute("href", href);
      }
    });

    // Batch 3 (UX audit) — the 23-item flat list is now six named sections.
    it("labels each section of the menu, mirroring the desktop nav's grouping", async () => {
      const clickUser = userEvent.setup();
      renderHeader();

      await clickUser.click(screen.getByRole("button", { name: "nav.menuLabel" }));
      const menu = await screen.findByRole("menu");

      for (const groupKey of [
        "workspace",
        "ticketingConfig",
        "reporting",
        "administration",
        "system",
        "account",
      ]) {
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
      const menu = await screen.findByRole("menu");

      expect(within(menu).queryByRole("menuitem", { name: "nav.branding" })).not.toBeInTheDocument();
      expect(
        within(menu).queryByRole("menuitem", { name: "nav.aiSettings" }),
      ).not.toBeInTheDocument();
      expect(
        within(menu).queryByRole("menuitem", { name: "nav.businessHours" }),
      ).not.toBeInTheDocument();
      expect(within(menu).getByRole("menuitem", { name: "nav.settings" })).toHaveAttribute(
        "href",
        "/en/settings",
      );
    });

    it("marks the current top-level route's menu item current, mirroring the desktop nav", async () => {
      const clickUser = userEvent.setup();
      pathname = "/en/tickets";
      renderHeader();

      await clickUser.click(screen.getByRole("button", { name: "nav.menuLabel" }));
      const menu = await screen.findByRole("menu");

      expect(within(menu).getByRole("menuitem", { name: "nav.tickets" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      expect(within(menu).getByRole("menuitem", { name: "nav.dashboard" })).not.toHaveAttribute(
        "aria-current",
      );
    });

    it("still marks the top-level menu item current from a nested detail route", async () => {
      const clickUser = userEvent.setup();
      pathname = "/en/tickets/ticket-1";
      renderHeader();

      await clickUser.click(screen.getByRole("button", { name: "nav.menuLabel" }));
      const menu = await screen.findByRole("menu");

      expect(within(menu).getByRole("menuitem", { name: "nav.tickets" })).toHaveAttribute(
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
        const menu = await screen.findByRole("menu");

        for (const [name, href] of EXPECTED_LINKS) {
          const arabicHref = href.replace("/en/", "/ar/");
          expect(within(menu).getByRole("menuitem", { name }), name).toHaveAttribute(
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
      const menu = await screen.findByRole("menu");

      expect(within(menu).getByLabelText(/unreadNotificationsLabel/)).toHaveTextContent("3");
    });

    it("renders no badge in the menu while the unread count is unknown or zero", async () => {
      const clickUser = userEvent.setup();
      renderHeader({ unreadCount: 0, unreadCountKnown: true });

      await clickUser.click(screen.getByRole("button", { name: "nav.menuLabel" }));
      const menu = await screen.findByRole("menu");

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

      expect(screen.queryByLabelText("branchSwitcher.label")).not.toBeInTheDocument();
    });

    it("renders a switcher, pre-selecting the currently active membership, once there is more than one", () => {
      mockedUseMyBranchMembershipsQuery.mockReturnValue({ data: twoMemberships } as never);

      renderHeader();

      const select = screen.getByLabelText("branchSwitcher.label") as HTMLSelectElement;
      expect(select).toHaveValue("branch-1::");
      expect(screen.getByText("Main Branch")).toBeInTheDocument();
      expect(screen.getByText("Second Branch")).toBeInTheDocument();
    });

    it("switches branch, clears the query cache, and refreshes the current route", async () => {
      mockedUseMyBranchMembershipsQuery.mockReturnValue({ data: twoMemberships } as never);
      mockedSwitchBranch.mockResolvedValue("new-access-token");

      renderHeader();
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
      fireEvent.change(screen.getByLabelText("branchSwitcher.label"), {
        target: { value: "branch-2::" },
      });

      expect(await screen.findByRole("alert")).toHaveTextContent("branchSwitcher.actionFailed");
    });

    it("clears a previous error and succeeds on a subsequent, successful switch", async () => {
      mockedUseMyBranchMembershipsQuery.mockReturnValue({ data: twoMemberships } as never);
      mockedSwitchBranch.mockRejectedValueOnce(new ApiError("Server error", 500));

      renderHeader();
      const select = screen.getByLabelText("branchSwitcher.label");
      fireEvent.change(select, { target: { value: "branch-2::" } });
      await screen.findByRole("alert");

      mockedSwitchBranch.mockResolvedValue("new-access-token");
      fireEvent.change(select, { target: { value: "branch-2::" } });

      await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  // Story 119 — i18n/RTL: Persisted locale preference + language switcher.
  describe("language switcher (Story 119)", () => {
    it("renders a switcher pre-selecting the current URL locale", () => {
      renderHeader();

      expect(screen.getByLabelText("languageSwitcher.label")).toHaveValue("en");
    });

    it("persists the new locale and navigates to the same page under the new locale segment", async () => {
      renderHeader();

      fireEvent.change(screen.getByLabelText("languageSwitcher.label"), {
        target: { value: "ar" },
      });

      await waitFor(() => expect(mockedUpdatePreferredLocale).toHaveBeenCalledWith("ar"));
      expect(push).toHaveBeenCalledWith("/ar/tickets");
    });

    it("still navigates when persisting the preference rejects", async () => {
      mockedUpdatePreferredLocale.mockRejectedValue(new Error("network down"));

      renderHeader();
      fireEvent.change(screen.getByLabelText("languageSwitcher.label"), {
        target: { value: "ar" },
      });

      await waitFor(() => expect(push).toHaveBeenCalledWith("/ar/tickets"));
    });

    it("does nothing when re-selecting the already-active locale", async () => {
      renderHeader();

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
});
