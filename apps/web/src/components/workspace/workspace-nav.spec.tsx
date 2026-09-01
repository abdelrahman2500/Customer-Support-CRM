import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WorkspaceNav } from "./workspace-nav";
import { useBrandingQuery } from "@/hooks/use-branding";
import { useUnreadNotificationCountQuery } from "@/hooks/use-notifications";
import { clearAccessToken, logout } from "@/lib/api";
import { clearQueryCache } from "@/lib/query-client-registry";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
}));

vi.mock("@/lib/api", () => ({
  logout: vi.fn(),
  clearAccessToken: vi.fn(),
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

const mockedLogout = vi.mocked(logout);
const mockedClearAccessToken = vi.mocked(clearAccessToken);
const mockedClearQueryCache = vi.mocked(clearQueryCache);
const mockedUseBrandingQuery = vi.mocked(useBrandingQuery);
const mockedUseUnreadNotificationCountQuery = vi.mocked(useUnreadNotificationCountQuery);

const user = {
  id: "user-1",
  email: "agent@example.com",
  fullName: "Ada Lovelace",
  branchId: "branch-1",
  departmentId: null,
  roles: ["Agent"],
};

describe("WorkspaceNav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedLogout.mockResolvedValue(undefined);
    mockedUseBrandingQuery.mockReturnValue({ data: undefined } as never);
    mockedUseUnreadNotificationCountQuery.mockReturnValue({
      data: undefined,
      isSuccess: false,
    } as never);
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
});
