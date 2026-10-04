import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Separator } from "./separator";

describe("Separator", () => {
  it("is decorative by default", () => {
    const { container } = render(<Separator />);
    const rule = container.firstElementChild as HTMLElement;
    expect(rule).toHaveAttribute("role", "none");
    expect(rule).toHaveClass("h-px", "w-full", "bg-rule");
  });

  it("exposes a meaningful separator with its orientation", () => {
    render(<Separator decorative={false} orientation="vertical" />);
    const rule = screen.getByRole("separator");
    expect(rule).toHaveAttribute("aria-orientation", "vertical");
    expect(rule).toHaveClass("w-px");
  });
});
