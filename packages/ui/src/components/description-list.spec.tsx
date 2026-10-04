import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DescriptionItem, DescriptionList } from "./description-list";

describe("DescriptionList", () => {
  it("renders term/description pairs in a real <dl>", () => {
    const { container } = render(
      <DescriptionList>
        <DescriptionItem term="Priority">High</DescriptionItem>
      </DescriptionList>,
    );
    expect(container.querySelector("dl")).not.toBeNull();
    expect(screen.getByText("Priority").tagName).toBe("DT");
    expect(screen.getByText("High").tagName).toBe("DD");
  });

  it("offers two columns from sm", () => {
    const { container } = render(
      <DescriptionList columns={2}>
        <DescriptionItem term="Status">Open</DescriptionItem>
      </DescriptionList>,
    );
    expect(container.querySelector("dl")).toHaveClass("sm:grid-cols-2");
  });
});
