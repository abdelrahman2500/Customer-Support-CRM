import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LocaleError from "./error";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

describe("LocaleError (Story 96)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders the localized error copy and a retry button that calls reset", () => {
    const reset = vi.fn();
    render(<LocaleError error={new Error("boom")} reset={reset} />);

    expect(screen.getByText("errorBoundary.title")).toBeInTheDocument();
    expect(screen.getByText("errorBoundary.description")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "errorBoundary.retry" }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("logs the error for local diagnosis without exposing its raw message in the UI", () => {
    const error = new Error("raw internal stack detail");
    render(<LocaleError error={error} reset={vi.fn()} />);

    expect(console.error).toHaveBeenCalledWith(error);
    expect(screen.queryByText("raw internal stack detail")).not.toBeInTheDocument();
  });
});
