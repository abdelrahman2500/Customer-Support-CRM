import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Spinner } from "./spinner";

describe("Spinner", () => {
  /** Decorative by default: the "busy" announcement belongs to the control
   * that owns the operation, not to a duplicate live region here. */
  it("is hidden from assistive technology by default", () => {
    const { container } = render(<Spinner />);

    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("becomes an announced status when given a label", () => {
    render(<Spinner label="Loading results" />);

    const status = screen.getByRole("status", { name: "Loading results" });
    expect(status).toBeInTheDocument();
    expect(status).not.toHaveAttribute("aria-hidden");
  });

  it("animates, and stops animating under prefers-reduced-motion", () => {
    const { container } = render(<Spinner />);

    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("animate-spin");
    expect(svg).toHaveClass("motion-reduce:animate-none");
  });

  it("takes its size from className", () => {
    const { container } = render(<Spinner className="h-6 w-6" />);

    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("h-6");
    expect(svg).not.toHaveClass("h-4");
  });
});
