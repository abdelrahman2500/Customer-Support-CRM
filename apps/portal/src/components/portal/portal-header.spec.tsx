import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PortalHeader } from "./portal-header";
import { useBrandingQuery } from "@/hooks/use-branding";
import { useUnreadNotificationCountQuery } from "@/hooks/use-portal-notification-history";
import { clearAccessToken, logout, updatePreferredLocale } from "@/lib/api";
import { clearQueryCache } from "@/lib/query-client-registry";
import { useRealtimeConnectionIssue } from "@/lib/realtime-connection";

const push = vi.fn();
let pathname = "/en/home";
// Story S-6 — mutable so a test can render under `/ar`, mirroring how
// `pathname` above is already varied per test.
let locale = "en";

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale }),
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
vi.mock("@/hooks/use-portal-notification-history", () => ({
  useUnreadNotificationCountQuery: vi.fn(),
}));

// Batch 7 (UX audit) — the shared connection's own behavior is covered by
// its dedicated `realtime-connection.spec.ts`; this file only needs to
// drive the banner's own on/off rendering.
vi.mock("@/lib/realtime-connection", () => ({
  useRealtimeConnectionIssue: vi.fn(() => false),
}));

const mockedLogout = vi.mocked(logout);
const mockedClearAccessToken = vi.mocked(clearAccessToken);
const mockedClearQueryCache = vi.mocked(clearQueryCache);
const mockedUpdatePreferredLocale = vi.mocked(updatePreferredLocale);
const mockedUseBrandingQuery = vi.mocked(useBrandingQuery);
const mockedUseUnreadNotificationCountQuery = vi.mocked(useUnreadNotificationCountQuery);
const mockedUseRealtimeConnectionIssue = vi.mocked(useRealtimeConnectionIssue);

const contact = {
  id: "contact-1",
  email: "jane@example.com",
  fullName: "Jane Doe",
  customerId: "customer-1",
  preferredLocale: null,
};

/** Story 200 (RD-2.6) — "signed in as", language, theme and sign-out live in
 * the user menu now, so a test that drives one of them opens it first. */
const userMenuTriggerName = `userMenu.trigger:${JSON.stringify({ name: contact.fullName })}`;
function openUserMenu() {
  fireEvent.click(screen.getByRole("button", { name: userMenuTriggerName }));
}

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
    mockedUpdatePreferredLocale.mockResolvedValue({ id: "contact-1" });
    mockedUseRealtimeConnectionIssue.mockReturnValue(false);
  });

  it("renders the signed-in contact's name", () => {
    render(<PortalHeader contact={contact} />);
    openUserMenu();

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

  /**
   * Story S-6 — the portal header's links are `next/link`s now rather than
   * plain anchors, so each is a client-side transition. The locale segment
   * is what a mistake here would corrupt: dropped, or doubled into
   * `/ar/ar`.
   */
  it("keeps the active locale segment on every header link under /ar", () => {
    locale = "ar";
    pathname = "/ar/home";
    try {
      render(<PortalHeader contact={contact} />);

      const hrefs = screen
        .getAllByRole("link")
        .map((link) => link.getAttribute("href") ?? "")
        .filter(Boolean);

      expect(hrefs).toContain("/ar/tickets");
      expect(hrefs).toContain("/ar/knowledge-base");
      expect(hrefs).toContain("/ar/chat");
      expect(hrefs).toContain("/ar/notifications");
      // The logo/home link too.
      expect(hrefs).toContain("/ar/home");

      for (const href of hrefs) {
        expect(href.startsWith("/ar/"), href).toBe(true);
        expect(href.startsWith("/ar/ar"), href).toBe(false);
      }
    } finally {
      locale = "en";
      pathname = "/en/home";
    }
  });

  it("calls the real logout, then clears the local token and query cache, and redirects to login, on sign-out", async () => {
    render(<PortalHeader contact={contact} />);
    openUserMenu();

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
    openUserMenu();

    fireEvent.click(screen.getByText("signOut"));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/en/login"));
    expect(mockedClearAccessToken).toHaveBeenCalledOnce();
  });

  // Story 82 — Branding — Live Logo/Color Consumption.
  describe("branding consumption (Story 82)", () => {
    // Story 200 (RD-2.6, recon PT-03) — the brand block links home: the app
    // name without a logo, the logo once configured. "Signed in as" moved
    // into the user menu.
    it("renders no logo, and the app name as the home link, when no branding is configured", () => {
      render(<PortalHeader contact={contact} />);

      expect(screen.queryByRole("img")).not.toBeInTheDocument();
      const brand = screen.getByRole("link", { name: "appName" });
      expect(brand).toHaveAttribute("href", "/en/home");
      expect(brand).toHaveClass("focus-ring", "min-w-0");
      expect(screen.getByText("appName")).toHaveClass("truncate");
    });

    it("renders the branch logo as the home link once one is configured, capped below sm", () => {
      mockedUseBrandingQuery.mockReturnValue({
        data: {
          logoUrl: "https://example.com/logo.png",
          primaryColor: null,
          secondaryColor: null,
        },
      } as never);

      render(<PortalHeader contact={contact} />);

      const logo = screen.getByRole("img");
      expect(logo).toHaveAttribute("src", "https://example.com/logo.png");
      expect(logo).toHaveClass("max-w-32", "sm:max-w-none", "object-contain");
      expect(logo.closest("a")).toHaveAttribute("href", "/en/home");
    });

    // Story 229 — the layout reads branding server-side and seeds the query
    // with it, so the first paint already has the logo and brand colour.
    it("seeds the branding query with the server-read branding", () => {
      const initialBranding = {
        logoUrl: "https://example.com/logo.png",
        primaryColor: "#112233",
        secondaryColor: null,
      };

      render(<PortalHeader contact={contact} initialBranding={initialBranding} />);

      expect(mockedUseBrandingQuery).toHaveBeenCalledWith(initialBranding);
    });

    it("seeds nothing when the server could not read branding", () => {
      render(<PortalHeader contact={contact} initialBranding={null} />);

      expect(mockedUseBrandingQuery).toHaveBeenCalledWith(undefined);
    });

    // Story 183 (RD-1.6) — branding goes through the controlled model:
    // BrandScope sets the `--brand` token the header's edge reads.
    it("leaves the brand token unset when no branding is configured", () => {
      render(<PortalHeader contact={contact} />);

      const header = screen.getByRole("banner");
      expect(header).toHaveClass("border-brand");
      expect(header.closest(".contents")?.getAttribute("style") ?? null).toBeNull();
    });

    it("sets the brand token from the branch primaryColor once configured", () => {
      mockedUseBrandingQuery.mockReturnValue({
        data: { logoUrl: null, primaryColor: "#112233", secondaryColor: null },
      } as never);

      render(<PortalHeader contact={contact} />);

      const scope = screen.getByRole("banner").closest(".contents") as HTMLElement;
      expect(scope.style.getPropertyValue("--brand")).toBe("17 34 51");
      expect(document.documentElement.style.getPropertyValue("--brand")).toBe("17 34 51");
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

      expect(screen.queryByRole("link", { name: /navUnread/ })).not.toBeInTheDocument();
      expect(screen.queryByText("5")).not.toBeInTheDocument();
    });

    it("renders no badge when the unread count is 0", () => {
      mockedUseUnreadNotificationCountQuery.mockReturnValue({
        data: { unreadCount: 0 },
        isSuccess: true,
      } as never);

      render(<PortalHeader contact={contact} />);

      expect(screen.queryByRole("link", { name: /navUnread/ })).not.toBeInTheDocument();
      expect(screen.queryByText("5")).not.toBeInTheDocument();
    });

    it("renders the unread count as a badge next to the notifications link once it is positive", () => {
      mockedUseUnreadNotificationCountQuery.mockReturnValue({
        data: { unreadCount: 5 },
        isSuccess: true,
      } as never);

      render(<PortalHeader contact={contact} />);

      // Story 200 (RD-2.6, recon A11Y-11) — the count is part of the link's
      // own accessible name; the visual badge is aria-hidden.
      const link = screen.getByRole("link", { name: `navUnread:${JSON.stringify({ count: 5 })}` });
      expect(link).toHaveAttribute("href", "/en/notifications");
      expect(within(link).getByText("5")).toHaveAttribute("aria-hidden", "true");
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

  // RM-11 — Mobile-Responsive Navigation.
  describe("collapsed mobile menu (RM-11)", () => {
    it("renders a menu toggle with an accessible name", () => {
      render(<PortalHeader contact={contact} />);

      expect(screen.getByRole("button", { name: "nav.menuLabel" })).toBeInTheDocument();
    });

    it("opens a real menu, with every nav item reachable inside it, once the toggle is clicked", async () => {
      const clickUser = userEvent.setup();
      render(<PortalHeader contact={contact} />);

      await clickUser.click(screen.getByRole("button", { name: "nav.menuLabel" }));

      const menu = await screen.findByRole("menu");
      const hrefs = within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.getAttribute("href"));
      expect(hrefs).toContain("/en/tickets");
      expect(hrefs).toContain("/en/knowledge-base");
      expect(hrefs).toContain("/en/chat");
      expect(hrefs).toContain("/en/notifications");
    });

    it("marks the current top-level route's menu item current, mirroring the desktop nav", async () => {
      const clickUser = userEvent.setup();
      pathname = "/en/tickets";
      render(<PortalHeader contact={contact} />);

      await clickUser.click(screen.getByRole("button", { name: "nav.menuLabel" }));
      const menu = await screen.findByRole("menu");

      const items = within(menu).getAllByRole("menuitem");
      const ticketsItem = items.find((item) => item.getAttribute("href") === "/en/tickets")!;
      const chatItem = items.find((item) => item.getAttribute("href") === "/en/chat")!;
      expect(ticketsItem).toHaveAttribute("aria-current", "page");
      expect(chatItem).not.toHaveAttribute("aria-current");
    });

    it("shows the unread-count badge on the menu's own notifications item too", async () => {
      const clickUser = userEvent.setup();
      mockedUseUnreadNotificationCountQuery.mockReturnValue({
        data: { unreadCount: 5 },
        isSuccess: true,
      } as never);

      render(<PortalHeader contact={contact} />);

      await clickUser.click(screen.getByRole("button", { name: "nav.menuLabel" }));
      const menu = await screen.findByRole("menu");

      const item = within(menu).getByRole("menuitem", {
        name: `navUnread:${JSON.stringify({ count: 5 })}`,
      });
      expect(within(item).getByText("5")).toHaveAttribute("aria-hidden", "true");
    });
  });

  // Story 200 (RD-2.6) — portal header v2.
  describe("header v2 (Story 200)", () => {
    it("adds an explicit Home item first, current on /home", () => {
      render(<PortalHeader contact={contact} />);

      const nav = screen.getByRole("navigation", { name: "nav.label" });
      const links = within(nav).getAllByRole("link");
      expect(links[0]).toHaveAttribute("href", "/en/home");
      expect(links[0]).toHaveTextContent("nav.home");
      expect(links[0]).toHaveAttribute("aria-current", "page");
    });

    it("opens a labelled account menu holding identity, language, theme and sign-out", () => {
      render(<PortalHeader contact={contact} />);
      openUserMenu();

      const menu = screen.getByRole("dialog", { name: "userMenu.label" });
      expect(
        within(menu).getByText(`signedInAs:${JSON.stringify({ name: contact.fullName })}`),
      ).toHaveClass("truncate");
      expect(within(menu).getByLabelText("languageSwitcher.label")).toBeInTheDocument();
      expect(within(menu).getByLabelText("themeSwitcher.label")).toBeInTheDocument();
      expect(within(menu).getByRole("button", { name: "signOut" })).toBeInTheDocument();
    });

    it("closes the account menu on Escape and returns focus to its trigger", async () => {
      const ue = userEvent.setup();
      render(<PortalHeader contact={contact} />);

      const trigger = screen.getByRole("button", { name: userMenuTriggerName });
      await ue.click(trigger);
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      await ue.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(trigger).toHaveFocus();
    });

    it("keeps the header to one row with the hamburger inside it", () => {
      render(<PortalHeader contact={contact} />);

      const header = screen.getByRole("banner");
      expect(header).not.toHaveClass("flex-wrap");
      expect(header).toContainElement(screen.getByRole("button", { name: "nav.menuLabel" }));
    });

    it("uses only logical-direction classes, menu included", () => {
      render(<PortalHeader contact={contact} />);
      openUserMenu();

      const header = screen.getByRole("banner");
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
      }
    });
  });

  // Story 119 — i18n/RTL: Persisted locale preference + language switcher.
  describe("language switcher (Story 119)", () => {
    it("renders a switcher pre-selecting the current URL locale", () => {
      render(<PortalHeader contact={contact} />);
      openUserMenu();

      expect(screen.getByLabelText("languageSwitcher.label")).toHaveValue("en");
    });

    it("persists the new locale and navigates to the same page under the new locale segment", async () => {
      pathname = "/en/tickets";
      render(<PortalHeader contact={contact} />);
      openUserMenu();

      fireEvent.change(screen.getByLabelText("languageSwitcher.label"), {
        target: { value: "ar" },
      });

      await waitFor(() => expect(mockedUpdatePreferredLocale).toHaveBeenCalledWith("ar"));
      expect(push).toHaveBeenCalledWith("/ar/tickets");
    });

    it("still navigates when persisting the preference rejects", async () => {
      mockedUpdatePreferredLocale.mockRejectedValue(new Error("network down"));
      pathname = "/en/tickets";

      render(<PortalHeader contact={contact} />);
      openUserMenu();
      fireEvent.change(screen.getByLabelText("languageSwitcher.label"), {
        target: { value: "ar" },
      });

      await waitFor(() => expect(push).toHaveBeenCalledWith("/ar/tickets"));
    });

    it("does nothing when re-selecting the already-active locale", async () => {
      render(<PortalHeader contact={contact} />);
      openUserMenu();

      fireEvent.change(screen.getByLabelText("languageSwitcher.label"), {
        target: { value: "en" },
      });

      await Promise.resolve();
      expect(mockedUpdatePreferredLocale).not.toHaveBeenCalled();
      expect(push).not.toHaveBeenCalled();
    });
  });

  // Batch 7 (UX audit) — mirrors `WorkspaceNav`'s own connection banner.
  describe("realtime connection banner (Batch 7)", () => {
    it("shows nothing while the shared connection is fine", () => {
      render(<PortalHeader contact={contact} />);

      expect(screen.queryByText("realtimeReconnecting")).not.toBeInTheDocument();
    });

    it("shows a non-destructive reconnecting banner once the shared connection reports an issue", () => {
      mockedUseRealtimeConnectionIssue.mockReturnValue(true);

      render(<PortalHeader contact={contact} />);

      expect(screen.getByText("realtimeReconnecting")).toBeInTheDocument();
    });
  });
});
