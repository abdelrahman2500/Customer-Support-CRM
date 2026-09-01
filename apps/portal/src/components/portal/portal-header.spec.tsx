import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PortalHeader } from "./portal-header";
import { useBrandingQuery } from "@/hooks/use-branding";
import { useUnreadNotificationCountQuery } from "@/hooks/use-portal-notification-history";
import { clearAccessToken, logout } from "@/lib/api";
import { clearQueryCache } from "@/lib/query-client-registry";

const push = vi.fn();
let pathname = "/en/home";

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push }),
  usePathname: () => pathname,
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
vi.mock("@/hooks/use-portal-notification-history", () => ({
  useUnreadNotificationCountQuery: vi.fn(),
}));

const mockedLogout = vi.mocked(logout);
const mockedClearAccessToken = vi.mocked(clearAccessToken);
const mockedClearQueryCache = vi.mocked(clearQueryCache);
const mockedUseBrandingQuery = vi.mocked(useBrandingQuery);
const mockedUseUnreadNotificationCountQuery = vi.mocked(useUnreadNotificationCountQuery);

const contact = {
  id: "contact-1",
  email: "jane@example.com",
  fullName: "Jane Doe",
  customerId: "customer-1",
};

describe("PortalHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pathname = "/en/home";
    mockedLogout.mockResolvedValue(undefined);
    mockedUseBrandingQuery.mockReturnValue({ data: undefined } as never);
    mockedUseUnreadNotificationCountQuery.mockReturnValue({
      data: undefined,
      isSuccess: false,
    } as never);
  });

  it("renders the signed-in contact's name", () => {
    render(<PortalHeader contact={contact} />);

    expect(
      screen.getByText(`signedInAs:${JSON.stringify({ name: contact.fullName })}`),
    ).toBeInTheDocument();
  });

  it("renders a nav link to the tickets screen (Story 53), Knowledge Base (Story 54), AI Chat (Story 80), and Notification History (Story 89)", () => {
    render(<PortalHeader contact={contact} />);

    // The mocked `useTranslations` ignores its namespace argument, so all
    // four links render the same "nav" text — assert by href instead of name.
    const navLinks = screen.getAllByRole("link", { name: "nav" });
    const hrefs = navLinks.map((link) => link.getAttribute("href"));
    expect(hrefs).toContain("/en/tickets");
    expect(hrefs).toContain("/en/knowledge-base");
    expect(hrefs).toContain("/en/chat");
    expect(hrefs).toContain("/en/notifications");
  });

  it("calls the real logout, then clears the local token and query cache, and redirects to login, on sign-out", async () => {
    render(<PortalHeader contact={contact} />);

    fireEvent.click(screen.getByText("signOut"));

    await waitFor(() => expect(mockedLogout).toHaveBeenCalledOnce());
    expect(mockedClearAccessToken).toHaveBeenCalledOnce();
    // Story 95 — a different contact signing in next must never see this
    // session's cached data flash before their own queries refetch.
    expect(mockedClearQueryCache).toHaveBeenCalledOnce();
    expect(push).toHaveBeenCalledWith("/en/login");
  });

  it("still clears the local token and redirects even when the logout call rejects", async () => {
    mockedLogout.mockRejectedValue(new Error("network down"));

    render(<PortalHeader contact={contact} />);

    fireEvent.click(screen.getByText("signOut"));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/en/login"));
    expect(mockedClearAccessToken).toHaveBeenCalledOnce();
  });

  // Story 82 — Branding — Live Logo/Color Consumption.
  describe("branding consumption (Story 82)", () => {
    it("renders no logo, and the signedInAs link unchanged, when no branding is configured", () => {
      render(<PortalHeader contact={contact} />);

      expect(screen.queryByRole("img")).not.toBeInTheDocument();
      expect(
        screen.getByText(`signedInAs:${JSON.stringify({ name: contact.fullName })}`),
      ).toBeInTheDocument();
    });

    it("renders the branch logo alongside the signedInAs link once one is configured", () => {
      mockedUseBrandingQuery.mockReturnValue({
        data: {
          logoUrl: "https://example.com/logo.png",
          primaryColor: null,
          secondaryColor: null,
        },
      } as never);

      render(<PortalHeader contact={contact} />);

      expect(screen.getByRole("img")).toHaveAttribute("src", "https://example.com/logo.png");
      expect(
        screen.getByText(`signedInAs:${JSON.stringify({ name: contact.fullName })}`),
      ).toBeInTheDocument();
    });

    it("leaves the header's brand-primary CSS variable unset when no branding is configured", () => {
      render(<PortalHeader contact={contact} />);

      const header = screen.getByRole("banner");
      expect(header.style.getPropertyValue("--brand-primary")).toBe("");
    });

    it("sets the header's brand-primary CSS variable once a primaryColor is configured", () => {
      mockedUseBrandingQuery.mockReturnValue({
        data: { logoUrl: null, primaryColor: "#112233", secondaryColor: null },
      } as never);

      render(<PortalHeader contact={contact} />);

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

      render(<PortalHeader contact={contact} />);

      expect(screen.queryByLabelText(/unreadNotificationsLabel/)).not.toBeInTheDocument();
    });

    it("renders no badge when the unread count is 0", () => {
      mockedUseUnreadNotificationCountQuery.mockReturnValue({
        data: { unreadCount: 0 },
        isSuccess: true,
      } as never);

      render(<PortalHeader contact={contact} />);

      expect(screen.queryByLabelText(/unreadNotificationsLabel/)).not.toBeInTheDocument();
    });

    it("renders the unread count as a badge next to the notifications link once it is positive", () => {
      mockedUseUnreadNotificationCountQuery.mockReturnValue({
        data: { unreadCount: 5 },
        isSuccess: true,
      } as never);

      render(<PortalHeader contact={contact} />);

      const badge = screen.getByLabelText(/unreadNotificationsLabel/);
      expect(badge).toHaveTextContent("5");
    });
  });

  // Story 96 — Navigation & Route Robustness.
  describe("accessibility and active-route indication (Story 96)", () => {
    it("labels the nav landmark with an accessible name", () => {
      render(<PortalHeader contact={contact} />);

      expect(screen.getByRole("navigation", { name: "nav.label" })).toBeInTheDocument();
    });

    it("marks the current top-level route's link as the current page", () => {
      pathname = "/en/tickets";
      render(<PortalHeader contact={contact} />);

      // The mocked `useTranslations` ignores namespace, so every nav link
      // shares the accessible name "nav" — distinguish by href instead.
      const links = screen.getAllByRole("link", { name: "nav" });
      const ticketsLink = links.find((link) => link.getAttribute("href") === "/en/tickets")!;
      const chatLink = links.find((link) => link.getAttribute("href") === "/en/chat")!;

      expect(ticketsLink).toHaveAttribute("aria-current", "page");
      expect(chatLink).not.toHaveAttribute("aria-current");
    });

    it("still marks the top-level link current from a nested detail route", () => {
      pathname = "/en/tickets/ticket-1";
      render(<PortalHeader contact={contact} />);

      const links = screen.getAllByRole("link", { name: "nav" });
      const ticketsLink = links.find((link) => link.getAttribute("href") === "/en/tickets")!;
      expect(ticketsLink).toHaveAttribute("aria-current", "page");
    });
  });
});
