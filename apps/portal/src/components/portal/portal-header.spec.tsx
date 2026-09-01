import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PortalHeader } from "./portal-header";
import { useBrandingQuery } from "@/hooks/use-branding";
import { clearAccessToken, logout } from "@/lib/api";

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

// Story 82 — Branding — Live Logo/Color Consumption.
vi.mock("@/hooks/use-branding", () => ({
  useBrandingQuery: vi.fn(),
}));

const mockedLogout = vi.mocked(logout);
const mockedClearAccessToken = vi.mocked(clearAccessToken);
const mockedUseBrandingQuery = vi.mocked(useBrandingQuery);

const contact = {
  id: "contact-1",
  email: "jane@example.com",
  fullName: "Jane Doe",
  customerId: "customer-1",
};

describe("PortalHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedLogout.mockResolvedValue(undefined);
    mockedUseBrandingQuery.mockReturnValue({ data: undefined } as never);
  });

  it("renders the signed-in contact's name", () => {
    render(<PortalHeader contact={contact} />);

    expect(
      screen.getByText(`signedInAs:${JSON.stringify({ name: contact.fullName })}`),
    ).toBeInTheDocument();
  });

  it("renders a nav link to the tickets screen (Story 53), Knowledge Base (Story 54), and AI Chat (Story 80)", () => {
    render(<PortalHeader contact={contact} />);

    // The mocked `useTranslations` ignores its namespace argument, so all
    // three links render the same "nav" text — assert by href instead of name.
    const navLinks = screen.getAllByRole("link", { name: "nav" });
    const hrefs = navLinks.map((link) => link.getAttribute("href"));
    expect(hrefs).toContain("/en/tickets");
    expect(hrefs).toContain("/en/knowledge-base");
    expect(hrefs).toContain("/en/chat");
  });

  it("calls the real logout, then clears the local token and redirects to login, on sign-out", async () => {
    render(<PortalHeader contact={contact} />);

    fireEvent.click(screen.getByText("signOut"));

    await waitFor(() => expect(mockedLogout).toHaveBeenCalledOnce());
    expect(mockedClearAccessToken).toHaveBeenCalledOnce();
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
});
