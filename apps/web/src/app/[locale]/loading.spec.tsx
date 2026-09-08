import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import Loading from "./loading";

/**
 * UX audit — the boundary that actually covers `(agent)/layout.tsx`'s
 * blocking `fetchCurrentUser()` call (see this file's own doc comment for
 * why none of the per-route `loading.tsx` files could). Same shared
 * `RouteLoadingSkeleton` those files already render, so this only needs to
 * prove it's wired up here too, not re-assert the skeleton's shape again.
 */
describe("Locale-root route loading (UX audit)", () => {
  it("renders the shared generic route-loading skeleton", () => {
    const { container } = render(<Loading />);

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(3);
  });
});
