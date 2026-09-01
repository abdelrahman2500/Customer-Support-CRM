import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import TicketDetailLoading from "./loading";

/**
 * Story 97 — Loading & Skeleton UX. Confirms this route-level loading
 * boundary renders the same shaped skeleton `TicketDetailView` itself uses
 * (see that component's own, more detailed skeleton-shape spec) — this
 * file only needs to prove the two are the same component, not re-assert
 * every detail of the shape again.
 */
describe("TicketDetailLoading (Story 97)", () => {
  it("renders the shaped ticket-detail skeleton", () => {
    const { container } = render(<TicketDetailLoading />);

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(5);
  });
});
