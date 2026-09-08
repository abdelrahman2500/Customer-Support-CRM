import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import Loading from "./loading";

/**
 * Global Navigation Loading — a representative sample, not one spec per
 * route. Every one of the ~30 route segments without a page-specific
 * skeleton (this one included) renders the exact same `RouteLoadingSkeleton`
 * import verbatim (see that component's own, more detailed shape/a11y spec
 * in `packages/ui`) — this file only needs to prove one of them actually
 * wires it up, not re-assert the shape 30 times over.
 */
describe("Dashboard route loading (UX audit)", () => {
  it("renders the shared generic route-loading skeleton", () => {
    const { container } = render(<Loading />);

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(3);
  });
});
