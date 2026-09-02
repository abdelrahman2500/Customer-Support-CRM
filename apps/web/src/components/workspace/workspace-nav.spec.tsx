import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WorkspaceNav } from "./workspace-nav";
import { useBrandingQuery } from "@/hooks/use-branding";
import { useMyBranchMembershipsQuery } from "@/hooks/use-branch-memberships";
import { useUnreadNotificationCountQuery } from "@/hooks/use-notifications";
import { clearAccessToken, logout, switchBranch, updatePreferredLocale } from "@/lib/api";
import { clearQueryCache } from "@/lib/query-client-registry";

const push = vi.fn();
const refresh = vi.fn();
let pathname = "/en/tickets";

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push, refresh }),
  usePathname: () => pathname,
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
}));

vi.mock("@/lib/api", () => ({
  logout: vi.fn(),
  clearAccessToken: vi.fn(),
  switchBranch: vi.fn(),
  updatePreferredLocale: vi.fn(),
}));

// Story 95 — Authentication Recovery.
vi.mock("@/lib/query-client-registry", () => ({
  clearQueryCache: vi.fn(),
}));

// Story 82 — Branding — Live Logo/Color Consumption.
vi.mock("@/hooks/use-branding", () => ({
  useBrandingQuery: vi.fn(),
}));

// Story 92 — Notification Read-State (unread-count badge).
vi.mock("@/hooks/use-notifications", () => ({
  useUnreadNotificationCountQuery: vi.fn(),
}));

// Story 118 — Branch switcher.
vi.mock("@/hooks/use-branch-memberships", () => ({
  useMyBranchMembershipsQuery: vi.fn(),
}));

const mockedLogout = vi.mocked(logout);
const mockedClearAccessToken = vi.mocked(clearAccessToken);
const mockedSwitchBranch = vi.mocked(switchBranch);
const mockedUpdatePreferredLocale = vi.mocked(updatePreferredLocale);
const mockedClearQueryCache = vi.mocked(clearQueryCache);
const mockedUseBrandingQuery = vi.mocked(useBrandingQuery);
const mockedUseUnreadNotificationCountQuery = vi.mocked(useUnreadNotificationCountQuery);
const mockedUseMyBranchMembershipsQuery = vi.mocked(useMyBranchMembershipsQuery);

const user = {
  id: "user-1",
  email: "agent@example.com",
  fullName: "Ada Lovelace",
  branchId: "branch-1",
  departmentId: null,
  roles: ["Agent"],
  preferredLocale: null,
};

describe("WorkspaceNav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pathname = "/en/tickets";
    mockedLogout.mockResolvedValue(undefined);
    mockedUseBrandingQuery.mockReturnValue({ data: undefined } as never);
    mockedUseUnreadNotificationCountQuery.mockReturnValue({
      data: undefined,
      isSuccess: false,
    } as never);
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
  });

  it("renders the app name and the signed-in user's name", () => {
    render(<WorkspaceNav user={user} />);

    expect(screen.getByText("appName")).toBeInTheDocument();
    expect(screen.getByText(`signedInAs:${JSON.stringify({ name: user.fullName })}`)).toBeInTheDocument();
  });

  it("calls the real logout, then clears the local token and query cache, and redirects to login, on sign-out", async () => {
    render(<WorkspaceNav user={user} />);

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

    render(<WorkspaceNav user={user} />);

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

    render(<WorkspaceNav user={user} />);
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

  // Story 44 — persistent navigation menu.
  describe("navigation links (Story 44)", () => {
    const EXPECTED_LINKS: Array<[name: string, href: string]> = [
      ["nav.dashboard", "/en/dashboard"],
      ["nav.tickets", "/en/tickets"],
      ["nav.customers", "/en/customers"],
      ["nav.slaPolicies", "/en/sla-policies"],
      ["nav.businessHours", "/en/business-hours"],
      ["nav.branches", "/en/branches"],
      ["nav.users", "/en/users"],
      ["nav.roles", "/en/roles"],
      ["nav.auditLogs", "/en/audit-logs"],
      ["nav.notifications", "/en/notifications"],
      ["nav.knowledgeBase", "/en/knowledge-base"],
      ["nav.aiSettings", "/en/ai-settings"],
    ];

    it("renders a link to every one of the eleven top-level Agent Workspace screens", () => {
      render(<WorkspaceNav user={user} />);

      for (const [name, href] of EXPECTED_LINKS) {
        expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
      }
    });

    it("labels the nav landmark with an accessible name", () => {
      render(<WorkspaceNav user={user} />);

      expect(screen.getByRole("navigation", { name: "nav.label" })).toBeInTheDocument();
    });

    it("still renders the existing app-name link and sign-out button unchanged, alongside the new nav row", () => {
      render(<WorkspaceNav user={user} />);

      expect(screen.getByRole("link", { name: "appName" })).toHaveAttribute("href", "/en/tickets");
      expect(screen.getByRole("button", { name: "signOut" })).toBeInTheDocument();
      expect(screen.getByText(`signedInAs:${JSON.stringify({ name: user.fullName })}`)).toBeInTheDocument();
    });
  });

  // Story 82 — Branding — Live Logo/Color Consumption.
  describe("branding consumption (Story 82)", () => {
    it("renders the plain app-name text link when no branding is configured", () => {
      mockedUseBrandingQuery.mockReturnValue({
        data: { logoUrl: null, primaryColor: null, secondaryColor: null },
      } as never);

      render(<WorkspaceNav user={user} />);

      expect(screen.getByRole("link", { name: "appName" })).toHaveAttribute("href", "/en/tickets");
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });

    it("renders the branch logo instead of the app-name text link once one is configured", () => {
      mockedUseBrandingQuery.mockReturnValue({
        data: {
          logoUrl: "https://example.com/logo.png",
          primaryColor: null,
          secondaryColor: null,
        },
      } as never);

      render(<WorkspaceNav user={user} />);

      expect(screen.getByRole("img", { name: "appName" })).toHaveAttribute(
        "src",
        "https://example.com/logo.png",
      );
      expect(screen.queryByRole("link", { name: "appName" })).not.toBeInTheDocument();
    });

    it("leaves the header's brand-primary CSS variable unset when no branding is configured", () => {
      render(<WorkspaceNav user={user} />);

      const header = screen.getByRole("banner");
      expect(header.style.getPropertyValue("--brand-primary")).toBe("");
    });

    it("sets the header's brand-primary CSS variable once a primaryColor is configured", () => {
      mockedUseBrandingQuery.mockReturnValue({
        data: { logoUrl: null, primaryColor: "#112233", secondaryColor: null },
      } as never);

      render(<WorkspaceNav user={user} />);

      const header = screen.getByRole("banner");
      expect(header.style.getPropertyValue("--brand-primary")).toBe("#112233");
    });
  });

  // Story 92 — Notification Read-State (unread-count badge).
  describe("unread-notification badge (Story 92)", () => {
    it("renders no badge while the unread-count query is loading or erroring", () => {
      mockedUseUnreadNotificationCountQuery.mockReturnValue({
        data: undefined,
        isSuccess: false,
      } as never);

      render(<WorkspaceNav user={user} />);

      expect(screen.queryByLabelText(/unreadNotificationsLabel/)).not.toBeInTheDocument();
    });

    it("renders no badge when the unread count is 0", () => {
      mockedUseUnreadNotificationCountQuery.mockReturnValue({
        data: { unreadCount: 0 },
        isSuccess: true,
      } as never);

      render(<WorkspaceNav user={user} />);

      expect(screen.queryByLabelText(/unreadNotificationsLabel/)).not.toBeInTheDocument();
    });

    it("renders the unread count as a badge next to the notifications link once it is positive", () => {
      mockedUseUnreadNotificationCountQuery.mockReturnValue({
        data: { unreadCount: 3 },
        isSuccess: true,
      } as never);

      render(<WorkspaceNav user={user} />);

      const badge = screen.getByLabelText(/unreadNotificationsLabel/);
      expect(badge).toHaveTextContent("3");
    });
  });

  // Story 96 — Navigation & Route Robustness.
  describe("active-route indication (Story 96)", () => {
    it("marks the current top-level route's link as the current page", () => {
      pathname = "/en/tickets";
      render(<WorkspaceNav user={user} />);

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
      render(<WorkspaceNav user={user} />);

      expect(screen.getByRole("link", { name: "nav.tickets" })).toHaveAttribute(
        "aria-current",
        "page",
      );
    });

    it("marks no link current on a route no nav item matches", () => {
      pathname = "/en/dashboard";
      render(<WorkspaceNav user={user} />);

      for (const link of screen.getAllByRole("link")) {
        if (link.getAttribute("href") !== "/en/dashboard") {
          expect(link).not.toHaveAttribute("aria-current");
        }
      }
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
      render(<WorkspaceNav user={user} />);

      expect(screen.queryByLabelText("branchSwitcher.label")).not.toBeInTheDocument();
    });

    it("renders a switcher, pre-selecting the currently active membership, once there is more than one", () => {
      mockedUseMyBranchMembershipsQuery.mockReturnValue({ data: twoMemberships } as never);

      render(<WorkspaceNav user={user} />);

      const select = screen.getByLabelText("branchSwitcher.label") as HTMLSelectElement;
      expect(select).toHaveValue("branch-1::");
      expect(screen.getByText("Main Branch")).toBeInTheDocument();
      expect(screen.getByText("Second Branch")).toBeInTheDocument();
    });

    it("switches branch, clears the query cache, and refreshes the current route", async () => {
      mockedUseMyBranchMembershipsQuery.mockReturnValue({ data: twoMemberships } as never);
      mockedSwitchBranch.mockResolvedValue("new-access-token");

      render(<WorkspaceNav user={user} />);
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

      render(<WorkspaceNav user={user} />);
      fireEvent.change(screen.getByLabelText("branchSwitcher.label"), {
        target: { value: "branch-2::dept-2" },
      });

      await waitFor(() =>
        expect(mockedSwitchBranch).toHaveBeenCalledWith("branch-2", "dept-2"),
      );
    });
  });

  // Story 119 — i18n/RTL: Persisted locale preference + language switcher.
  describe("language switcher (Story 119)", () => {
    it("renders a switcher pre-selecting the current URL locale", () => {
      render(<WorkspaceNav user={user} />);

      expect(screen.getByLabelText("languageSwitcher.label")).toHaveValue("en");
    });

    it("persists the new locale and navigates to the same page under the new locale segment", async () => {
      render(<WorkspaceNav user={user} />);

      fireEvent.change(screen.getByLabelText("languageSwitcher.label"), {
        target: { value: "ar" },
      });

      await waitFor(() => expect(mockedUpdatePreferredLocale).toHaveBeenCalledWith("ar"));
      expect(push).toHaveBeenCalledWith("/ar/tickets");
    });

    it("still navigates when persisting the preference rejects", async () => {
      mockedUpdatePreferredLocale.mockRejectedValue(new Error("network down"));

      render(<WorkspaceNav user={user} />);
      fireEvent.change(screen.getByLabelText("languageSwitcher.label"), {
        target: { value: "ar" },
      });

      await waitFor(() => expect(push).toHaveBeenCalledWith("/ar/tickets"));
    });

    it("does nothing when re-selecting the already-active locale", async () => {
      render(<WorkspaceNav user={user} />);

      fireEvent.change(screen.getByLabelText("languageSwitcher.label"), {
        target: { value: "en" },
      });

      await Promise.resolve();
      expect(mockedUpdatePreferredLocale).not.toHaveBeenCalled();
      expect(push).not.toHaveBeenCalled();
    });

    it("preserves a nested path when switching locale", async () => {
      pathname = "/en/tickets/ticket-1";

      render(<WorkspaceNav user={user} />);
      fireEvent.change(screen.getByLabelText("languageSwitcher.label"), {
        target: { value: "ar" },
      });

      await waitFor(() => expect(push).toHaveBeenCalledWith("/ar/tickets/ticket-1"));
    });
  });
});
