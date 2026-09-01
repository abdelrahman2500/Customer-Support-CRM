import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginPage from "./page";
import { setAccessToken } from "@/lib/api";

const push = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push }),
  useSearchParams: () => searchParams,
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

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    searchParams = new URLSearchParams();
  });

  it("renders the sign-in form", () => {
    render(<LoginPage />);

    expect(screen.getByText("title")).toBeInTheDocument();
    expect(screen.getByText("signIn")).toBeInTheDocument();
  });

  it("posts to /auth/login with credentials included, sets the access token, and navigates to tickets on success", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: "signed.access.token" }),
    } as Response);

    render(<LoginPage />);
    fireEvent.change(screen.getByText("email").querySelector("input")!, {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByText("password").querySelector("input")!, {
      target: { value: "correct-password" },
    });
    fireEvent.click(screen.getByText("signIn"));

    await waitFor(() => expect(setAccessToken).toHaveBeenCalledWith("signed.access.token"));
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/login"),
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ email: "ada@example.com", password: "correct-password" }),
      }),
    );
    expect(push).toHaveBeenCalledWith("/en/tickets");
  });

  it("shows a generic sign-in-failed message on a non-2xx response, without navigating", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);

    render(<LoginPage />);
    fireEvent.change(screen.getByText("email").querySelector("input")!, {
      target: { value: "ada@example.com" },
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
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByText("password").querySelector("input")!, {
      target: { value: "whatever" },
    });
    fireEvent.click(screen.getByText("signIn"));

    expect(await screen.findByText("loginFailed")).toBeInTheDocument();
  });

  // Story 95 — Authentication Recovery.
  describe("session-expired banner (Story 95)", () => {
    it("renders no banner on an ordinary visit", () => {
      render(<LoginPage />);

      expect(screen.queryByText("errors.unauthorized")).not.toBeInTheDocument();
    });

    it("renders the shared session-expired copy when redirected with ?reason=session-expired", () => {
      searchParams = new URLSearchParams("reason=session-expired");

      render(<LoginPage />);

      expect(screen.getByText("errors.unauthorized")).toBeInTheDocument();
    });

    it("hides the session-expired banner once a real login failure occurs", async () => {
      searchParams = new URLSearchParams("reason=session-expired");
      vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);

      render(<LoginPage />);
      expect(screen.getByText("errors.unauthorized")).toBeInTheDocument();

      fireEvent.change(screen.getByText("email").querySelector("input")!, {
        target: { value: "ada@example.com" },
      });
      fireEvent.change(screen.getByText("password").querySelector("input")!, {
        target: { value: "wrong-password" },
      });
      fireEvent.click(screen.getByText("signIn"));

      expect(await screen.findByText("loginFailed")).toBeInTheDocument();
      expect(screen.queryByText("errors.unauthorized")).not.toBeInTheDocument();
    });
  });
});
