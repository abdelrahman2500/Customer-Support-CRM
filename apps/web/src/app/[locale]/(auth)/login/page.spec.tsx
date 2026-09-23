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
    fireEvent.change(screen.getByLabelText("email"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText("password"), {
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

  // UX audit — the destination route's own layout does a server-side
  // auth-init round trip before it can render anything, and `router.push`
  // doesn't wait for that. The button used to flip back to its idle
  // "Sign in" state right here, on a still-visible /login page, for that
  // entire round trip — this locks in the fix: it stays pending/disabled
  // past the successful push, until this component unmounts.
  it("keeps the sign-in button pending/disabled after a successful submit, past the push call", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: "signed.access.token" }),
    } as Response);

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("email"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText("password"), {
      target: { value: "correct-password" },
    });
    fireEvent.click(screen.getByText("signIn"));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/en/tickets"));
    expect(screen.getByText("signingIn")).toBeInTheDocument();
    expect(screen.queryByText("signIn")).not.toBeInTheDocument();
    expect(screen.getByText("signingIn").closest("button")).toBeDisabled();
  });

  it("shows a generic sign-in-failed message on a non-2xx response, without navigating", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("email"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText("password"), {
      target: { value: "wrong-password" },
    });
    fireEvent.click(screen.getByText("signIn"));

    expect(await screen.findByText("loginFailed")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("shows a generic sign-in-failed message when the request itself throws (network error)", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("email"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText("password"), {
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

      fireEvent.change(screen.getByLabelText("email"), {
        target: { value: "ada@example.com" },
      });
      fireEvent.change(screen.getByLabelText("password"), {
        target: { value: "wrong-password" },
      });
      fireEvent.click(screen.getByText("signIn"));

      expect(await screen.findByText("loginFailed")).toBeInTheDocument();
      expect(screen.queryByText("errors.unauthorized")).not.toBeInTheDocument();
    });
  });

  /**
   * Story 168 — the redesign. Every test below is about behaviour the
   * redesign introduced or is required to preserve; none asserts on the
   * visual composition itself, which a unit test can only restate.
   */
  describe("redesigned sign-in screen (Story 168)", () => {
    it("focuses the email field on load", () => {
      render(<LoginPage />);

      expect(screen.getByLabelText("email")).toHaveFocus();
    });

    it("associates both labels with their controls through FormField", () => {
      render(<LoginPage />);

      const emailInput = screen.getByLabelText("email");
      const passwordInput = screen.getByLabelText("password");

      expect(emailInput).toHaveAttribute("type", "email");
      expect(emailInput).toHaveAttribute("autocomplete", "email");
      expect(emailInput).toBeRequired();
      expect(passwordInput).toHaveAttribute("type", "password");
      expect(passwordInput).toHaveAttribute("autocomplete", "current-password");
      expect(passwordInput).toBeRequired();
    });

    it("marks the submit button busy and disabled while the request is in flight", async () => {
      vi.mocked(fetch).mockReturnValue(new Promise(() => {}) as Promise<Response>);

      render(<LoginPage />);
      fireEvent.change(screen.getByLabelText("email"), { target: { value: "ada@example.com" } });
      fireEvent.change(screen.getByLabelText("password"), { target: { value: "pw" } });
      fireEvent.click(screen.getByText("signIn"));

      const button = (await screen.findByText("signingIn")).closest("button")!;
      expect(button).toHaveAttribute("aria-busy", "true");
      expect(button).toBeDisabled();
    });

    /**
     * `Button`'s `isLoading` renders its label inside
     * `<span className="invisible">`, and a real browser excludes a
     * `visibility: hidden` subtree from the accessible name — so without an
     * explicit label the pending button would be unnamed. jsdom loads no
     * Tailwind CSS and therefore cannot observe that, which is exactly why
     * this asserts the attribute rather than querying by role name: a
     * role-name query here is green either way.
     */
    it("names the submit button explicitly while pending, and only while pending", async () => {
      vi.mocked(fetch).mockReturnValue(new Promise(() => {}) as Promise<Response>);

      render(<LoginPage />);
      expect(screen.getByText("signIn").closest("button")).not.toHaveAttribute("aria-label");

      fireEvent.change(screen.getByLabelText("email"), { target: { value: "ada@example.com" } });
      fireEvent.change(screen.getByLabelText("password"), { target: { value: "pw" } });
      fireEvent.click(screen.getByText("signIn"));

      const button = (await screen.findByText("signingIn")).closest("button")!;
      expect(button).toHaveAttribute("aria-label", "signingIn");
    });

    it("keeps a single level-1 heading for the page", () => {
      render(<LoginPage />);

      const headings = screen.getAllByRole("heading", { level: 1 });
      expect(headings).toHaveLength(1);
      expect(headings[0]).toHaveTextContent("title");
    });

    it("shows the product name as the screen's identity", () => {
      render(<LoginPage />);

      expect(screen.getByText("appName")).toBeInTheDocument();
    });

    describe("pre-auth locale switcher", () => {
      it("renders a labelled switcher set to the current locale, with both locales", () => {
        render(<LoginPage />);

        const select = screen.getByRole("combobox", { name: "languageSwitcher.label" });
        expect(select).toHaveValue("en");
        expect(screen.getAllByRole("option")).toHaveLength(2);
      });

      it("navigates to the target locale's login route", () => {
        render(<LoginPage />);

        fireEvent.change(screen.getByRole("combobox", { name: "languageSwitcher.label" }), {
          target: { value: "ar" },
        });

        expect(push).toHaveBeenCalledWith("/ar/login");
      });

      it("preserves the query string, so the session-expired banner survives the switch", () => {
        searchParams = new URLSearchParams("reason=session-expired");

        render(<LoginPage />);

        fireEvent.change(screen.getByRole("combobox", { name: "languageSwitcher.label" }), {
          target: { value: "ar" },
        });

        expect(push).toHaveBeenCalledWith("/ar/login?reason=session-expired");
      });

      it("does nothing when the current locale is selected", () => {
        render(<LoginPage />);

        fireEvent.change(screen.getByRole("combobox", { name: "languageSwitcher.label" }), {
          target: { value: "en" },
        });

        expect(push).not.toHaveBeenCalled();
      });

      // Nobody is signed in here, so there is no preference to persist and
      // `updatePreferredLocale` would 401. This is the test that catches
      // someone copying `workspace-header.tsx`'s handler wholesale.
      it("persists nothing — no request is made when switching locale", () => {
        render(<LoginPage />);

        fireEvent.change(screen.getByRole("combobox", { name: "languageSwitcher.label" }), {
          target: { value: "ar" },
        });

        expect(fetch).not.toHaveBeenCalled();
      });
    });

    /**
     * RTL safety. Copies the idiom from `workspace-sidebar.spec.tsx`: the
     * one class-level assertion here, because it guards a criterion
     * (`docs/architecture/12-risks-tradeoffs-and-scope.md`'s risk #1) that
     * no behavioural assertion can reach.
     */
    it("uses only logical-direction classes", () => {
      const { container } = render(<LoginPage />);

      for (const element of container.querySelectorAll("[class]")) {
        const classes = element.className.toString().split(/\s+/);
        expect(classes.some((c) => /^(ml|mr|pl|pr|left|right|text-left|text-right)-/.test(c))).toBe(
          false,
        );
        expect(classes.some((c) => /^border-[lr]-/.test(c))).toBe(false);
      }
    });
  });
});
