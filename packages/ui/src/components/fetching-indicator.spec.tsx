import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FetchingIndicator } from "./fetching-indicator";

describe("FetchingIndicator", () => {
  it("renders nothing while idle", () => {
    const { container } = render(<FetchingIndicator label="Updating…" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when explicitly inactive", () => {
    const { container } = render(<FetchingIndicator active={false} label="Updating…" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("announces the refresh politely, never as an interruption", () => {
    render(<FetchingIndicator active label="Updating…" />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("Updating…");
    // A refresh in progress must not talk over the user.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a spinning indicator alongside the label", () => {
    const { container } = render(<FetchingIndicator active label="Updating…" />);

    const spinner = container.querySelector("svg");
    expect(spinner).toHaveClass("animate-spin");
    // The label carries the meaning, so the glyph is decorative.
    expect(spinner).toHaveAttribute("aria-hidden");
  });

  it("takes an already-translated label, holding no copy of its own", () => {
    render(<FetchingIndicator active label="جارٍ التحديث…" />);

    expect(screen.getByRole("status")).toHaveTextContent("جارٍ التحديث…");
  });

  it("merges a caller className and spreads other div props", () => {
    render(<FetchingIndicator active label="Updating…" className="ms-2" data-testid="fi" />);

    const element = screen.getByTestId("fi");
    expect(element).toHaveClass("ms-2");
    expect(element).toHaveClass("flex");
  });
});
