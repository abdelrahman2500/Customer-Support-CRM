import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AgentWorkspaceError from "./error";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "ar" }),
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

// Imported after the mock so the mocked module is what the component sees.
import * as Sentry from "@sentry/nextjs";

/** Story 199 (RD-2.5, recon NAV-05) — the in-shell agent error boundary. */
describe("AgentWorkspaceError (Story 199)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders the page's h1, a retry that calls reset, and a way back in the active locale", () => {
    const reset = vi.fn();
    render(<AgentWorkspaceError error={new Error("boom")} reset={reset} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "errorBoundary.title" }),
    ).toBeInTheDocument();
    expect(screen.getByText("errorBoundary.description")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "errorBoundary.retry" }));
    expect(reset).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "backLinkLabel" })).toHaveAttribute(
      "href",
      "/ar/tickets",
    );
  });

  it("renders inside the shell's <main>, never a <main> of its own", () => {
    const { container } = render(<AgentWorkspaceError error={new Error("boom")} reset={vi.fn()} />);

    expect(container.querySelector("main")).toBeNull();
  });

  it("logs and reports the error without exposing its raw message", () => {
    const error = new Error("raw internal stack detail");
    render(<AgentWorkspaceError error={error} reset={vi.fn()} />);

    expect(console.error).toHaveBeenCalledWith(error);
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
    expect(screen.queryByText("raw internal stack detail")).not.toBeInTheDocument();
  });
});
