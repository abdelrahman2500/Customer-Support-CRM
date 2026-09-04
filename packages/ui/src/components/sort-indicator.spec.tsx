import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { SortIndicator } from "./sort-indicator";

describe("SortIndicator", () => {
  it("renders nothing for an unsorted column by default", () => {
    const { container } = render(<SortIndicator direction={null} />);

    // The three headers this replaces rendered an empty string when their
    // column was not the sorted one; that stays true.
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when no direction is supplied at all", () => {
    const { container } = render(<SortIndicator />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders a neutral affordance for an unsorted column when asked", () => {
    const { container } = render(<SortIndicator direction={null} showInactive />);

    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders a different glyph for each direction", () => {
    const asc = render(<SortIndicator direction="asc" />);
    const ascPath = asc.container.querySelector("svg")?.innerHTML;
    asc.unmount();

    const desc = render(<SortIndicator direction="desc" />);
    const descPath = desc.container.querySelector("svg")?.innerHTML;

    expect(ascPath).toBeTruthy();
    expect(descPath).toBeTruthy();
    expect(ascPath).not.toBe(descPath);
  });

  it("is hidden from assistive technology", () => {
    // The sort state belongs on the header as aria-sort, which only the
    // caller can set; announcing the arrow too would say it twice.
    const { container } = render(<SortIndicator direction="asc" />);

    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("uses a logical margin so it follows the reading direction", () => {
    const { container } = render(<SortIndicator direction="asc" />);

    const svg = container.querySelector("svg") as SVGElement;
    // `ms-1`, not `ml-1` — under RTL the arrow sits to the label's left.
    expect(svg.getAttribute("class")).toContain("ms-1");
    expect(svg.getAttribute("class")).not.toContain("ml-1");
  });

  it("merges a caller className", () => {
    const { container } = render(<SortIndicator direction="desc" className="text-ink-subtle" />);

    expect(container.querySelector("svg")?.getAttribute("class")).toContain("text-ink-subtle");
  });
});
