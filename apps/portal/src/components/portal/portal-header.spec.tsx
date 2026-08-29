import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PortalHeader } from "./portal-header";
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

const mockedLogout = vi.mocked(logout);
const mockedClearAccessToken = vi.mocked(clearAccessToken);

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
  });

  it("renders the signed-in contact's name", () => {
    render(<PortalHeader contact={contact} />);

    expect(
      screen.getByText(`signedInAs:${JSON.stringify({ name: contact.fullName })}`),
    ).toBeInTheDocument();
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
});
