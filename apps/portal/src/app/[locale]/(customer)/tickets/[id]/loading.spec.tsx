import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import TicketDetailLoading from "./loading";

describe("TicketDetailLoading (portal, Story 97)", () => {
  it("renders the shaped ticket-detail skeleton", () => {
    const { container } = render(<TicketDetailLoading />);

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(5);
  });
});
