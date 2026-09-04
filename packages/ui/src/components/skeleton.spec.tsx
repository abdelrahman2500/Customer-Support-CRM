import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Skeleton } from "./skeleton";

/**
 * Story S-2 — ported from `apps/portal`'s own `skeleton.spec.tsx`, which was
 * this component's only coverage before the two apps' duplicate
 * implementations were consolidated here. Every assertion is carried over;
 * the one changed expectation is the base tint, because consolidation had to
 * pick a single shade: the portal's copy used `bg-surface-muted` (slate-100)
 * and the agent workspace's used `bg-rule` (slate-200). `bg-rule` wins as
 * the more legible of the two, so the portal's skeletons are now one step
 * darker — the single intentional visual change in this story.
 */
describe("Skeleton", () => {
  it("renders a pulsing placeholder block", () => {
    const { container } = render(<Skeleton className="h-10 w-full" />);

    const element = container.firstElementChild as HTMLElement;
    expect(element).toHaveClass("animate-pulse");
    expect(element).toHaveClass("rounded-md");
    expect(element).toHaveClass("bg-rule");
  });

  it("merges a caller-supplied className onto the base classes", () => {
    const { container } = render(<Skeleton className="h-10 w-full" />);

    const element = container.firstElementChild as HTMLElement;
    expect(element).toHaveClass("h-10");
    expect(element).toHaveClass("w-full");
  });

  it("lets a caller override the base tint (tailwind-merge, not concatenation)", () => {
    const { container } = render(<Skeleton className="bg-surface-muted" />);

    const element = container.firstElementChild as HTMLElement;
    expect(element).toHaveClass("bg-surface-muted");
    expect(element).not.toHaveClass("bg-rule");
  });

  it("spreads through other div props", () => {
    const { container } = render(<Skeleton aria-hidden="true" />);

    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});
