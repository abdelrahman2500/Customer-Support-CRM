import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import Loading from "./loading";

/**
 * Global Navigation Loading — mirrors `apps/web`'s own representative
 * sample (`(agent)/dashboard/loading.spec.tsx`): every uncovered portal
 * route segment renders the same shared `RouteLoadingSkeleton` verbatim, so
 * one sample proves the wiring without repeating the same test five times.
 */
describe("Portal home route loading (UX audit)", () => {
  it("renders the shared generic route-loading skeleton", () => {
    const { container } = render(<Loading />);

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(3);
  });
});
