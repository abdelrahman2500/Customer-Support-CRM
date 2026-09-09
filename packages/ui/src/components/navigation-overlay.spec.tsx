import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NavigationOverlay } from "./navigation-overlay";

describe("NavigationOverlay", () => {
  it("renders no backdrop/spinner while hidden", () => {
    render(<NavigationOverlay visible={false} label="Loading…" />);

    expect(screen.getByRole("status")).not.toHaveTextContent("Loading…");
    expect(document.querySelector("svg")).not.toBeInTheDocument();
  });

  it("marks the status region not busy while hidden", () => {
    render(<NavigationOverlay visible={false} label="Loading…" />);

    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "false");
  });

  it("shows a full-viewport backdrop and a spinner once visible", () => {
    render(<NavigationOverlay visible label="Loading…" />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    const backdrop = status.querySelector(".fixed.inset-0");
    expect(backdrop).toBeInTheDocument();
    expect(backdrop?.querySelector("svg")).toHaveClass("animate-spin");
  });

  it("announces the label politely to assistive technology, without showing it visually", () => {
    render(<NavigationOverlay visible label="Loading…" />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("Loading…");
    expect(screen.getByText("Loading…")).toHaveClass("sr-only");
  });

  it("takes an already-translated label, holding no copy of its own", () => {
    render(<NavigationOverlay visible label="جارٍ التحميل…" />);

    expect(screen.getByRole("status")).toHaveTextContent("جارٍ التحميل…");
  });

  it("never announces as an interruption", () => {
    render(<NavigationOverlay visible label="Loading…" />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
