import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import CustomerDetailLoading from "./loading";

describe("CustomerDetailLoading (Story 97)", () => {
  it("renders the shaped customer-detail skeleton", () => {
    const { container } = render(<CustomerDetailLoading />);

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(3);
  });
});
