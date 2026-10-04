import * as React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Input } from "./input";

const SearchGlyph = (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="glyph" {...props} />;

describe("Input (Story 186)", () => {
  it("is a comfortable 40px control with the shared control tokens", () => {
    render(<Input aria-label="Name" />);
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveClass(
      "h-10",
      "rounded-control",
      "border-rule-control",
      "focus-ring",
      "aria-[invalid=true]:border-danger-solid",
    );
  });

  it("offers a compact 32px size without clashing with the native size attribute", () => {
    render(<Input aria-label="Filter" controlSize="sm" size={12} />);
    const input = screen.getByRole("textbox", { name: "Filter" });
    expect(input).toHaveClass("h-8");
    expect(input).toHaveAttribute("size", "12");
  });

  it("applies a caller className to the input itself when unadorned", () => {
    render(<Input aria-label="Name" className="sm:w-64" />);
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveClass("sm:w-64");
  });

  it("wraps a decorative start icon and moves className to the wrapper", () => {
    render(<Input aria-label="Search" startIcon={SearchGlyph as never} className="sm:w-64" />);
    const input = screen.getByRole("textbox", { name: "Search" });
    expect(input).toHaveClass("ps-9");
    expect(input).not.toHaveClass("sm:w-64");
    expect(input.parentElement).toHaveClass("relative", "sm:w-64");
    expect(screen.getByTestId("glyph")).toHaveAttribute("aria-hidden", "true");
  });

  it("renders trailing content inside the control", () => {
    render(<Input aria-label="Search" endSlot={<button type="button">Clear</button>} />);
    expect(screen.getByRole("textbox", { name: "Search" })).toHaveClass("pe-10");
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
  });

  it("forwards its ref to the input", () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input aria-label="Name" ref={ref} startIcon={SearchGlyph as never} />);
    expect(ref.current).toBe(screen.getByRole("textbox", { name: "Name" }));
  });
});
