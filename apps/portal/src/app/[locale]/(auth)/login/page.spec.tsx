import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginPage from "./page";
import { setAccessToken } from "@/lib/api";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    setAccessToken: vi.fn(),
  };
});

describe("LoginPage (portal)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders the sign-in form", () => {
    render(<LoginPage />);

    expect(screen.getByText("title")).toBeInTheDocument();
    expect(screen.getByText("signIn")).toBeInTheDocument();
  });

  it("posts to /portal/auth/login with credentials included, sets the access token, and navigates home on success", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: "signed.access.token" }),
    } as Response);

    render(<LoginPage />);
    fireEvent.change(screen.getByText("email").querySelector("input")!, {
      target: { value: "jane@example.com" },
    });
    fireEvent.change(screen.getByText("password").querySelector("input")!, {
      target: { value: "correct-password" },
    });
    fireEvent.click(screen.getByText("signIn"));

    await waitFor(() => expect(setAccessToken).toHaveBeenCalledWith("signed.access.token"));
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/portal/auth/login"),
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ email: "jane@example.com", password: "correct-password" }),
      }),
    );
    expect(push).toHaveBeenCalledWith("/en/home");
  });

  it("shows a generic sign-in-failed message on a non-2xx response, without navigating", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);

    render(<LoginPage />);
    fireEvent.change(screen.getByText("email").querySelector("input")!, {
      target: { value: "jane@example.com" },
    });
    fireEvent.change(screen.getByText("password").querySelector("input")!, {
      target: { value: "wrong-password" },
    });
    fireEvent.click(screen.getByText("signIn"));

    expect(await screen.findByText("loginFailed")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("shows a generic sign-in-failed message when the request itself throws (network error)", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));

    render(<LoginPage />);
    fireEvent.change(screen.getByText("email").querySelector("input")!, {
      target: { value: "jane@example.com" },
    });
    fireEvent.change(screen.getByText("password").querySelector("input")!, {
      target: { value: "whatever" },
    });
    fireEvent.click(screen.getByText("signIn"));

    expect(await screen.findByText("loginFailed")).toBeInTheDocument();
  });
});
