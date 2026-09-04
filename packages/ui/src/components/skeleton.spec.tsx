import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Skeleton, SkeletonText, SkeletonCard } from "./skeleton";

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

/**
 * Story S-4 — the two composable shapes added on top of the base block.
 * Both are hidden from assistive technology by default, because announcing
 * that something is loading belongs to `QueryStateCard`s labelled live
 * region, once, rather than to each individual bar.
 */
describe("SkeletonText", () => {
  it("draws the requested number of bars", () => {
    const { container } = render(<SkeletonText lines={5} />);

    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(5);
  });

  it("defaults to three bars", () => {
    const { container } = render(<SkeletonText />);

    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(3);
  });

  it("is hidden from assistive technology", () => {
    const { container } = render(<SkeletonText />);

    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("applies a caller bar height to every bar", () => {
    const { container } = render(<SkeletonText lines={2} barClassName="h-10" />);

    for (const bar of container.querySelectorAll(".animate-pulse")) {
      expect(bar).toHaveClass("h-10");
      // tailwind-merge replaced the default height rather than appending.
      expect(bar).not.toHaveClass("h-4");
    }
  });

  it("renders nothing for a non-positive line count", () => {
    const { container } = render(<SkeletonText lines={0} />);

    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(0);
  });
});

describe("SkeletonCard", () => {
  it("draws a heading bar plus the requested body bars", () => {
    const { container } = render(<SkeletonCard lines={3} />);

    // 1 heading + 3 body.
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(4);
  });

  it("is hidden from assistive technology as a single subtree", () => {
    const { container } = render(<SkeletonCard />);

    const card = container.firstElementChild as HTMLElement;
    expect(card).toHaveAttribute("aria-hidden", "true");
    // Not repeated on the inner group.
    expect(card.querySelectorAll("[aria-hidden]")).toHaveLength(0);
  });

  it("takes its panel chrome from the shared Card", () => {
    const { container } = render(<SkeletonCard />);

    const card = container.firstElementChild as HTMLElement;
    expect(card).toHaveClass("rounded-md");
    expect(card).toHaveClass("border-rule");
    expect(card).toHaveClass("bg-surface");
  });
});
