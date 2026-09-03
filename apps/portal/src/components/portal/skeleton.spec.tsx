import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Skeleton } from "./skeleton";

describe("Skeleton (portal, Story 97)", () => {
  it("renders a pulsing placeholder block", () => {
    const { container } = render(<Skeleton className="h-10 w-full" />);

    const element = container.firstElementChild as HTMLElement;
    expect(element).toHaveClass("animate-pulse");
    expect(element).toHaveClass("rounded-md");
    expect(element).toHaveClass("bg-surface-muted");
  });

  it("merges a caller-supplied className onto the base classes", () => {
    const { container } = render(<Skeleton className="h-10 w-full" />);

    const element = container.firstElementChild as HTMLElement;
    expect(element).toHaveClass("h-10");
    expect(element).toHaveClass("w-full");
  });

  it("spreads through other div props", () => {
    const { container } = render(<Skeleton aria-hidden="true" />);

    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});
