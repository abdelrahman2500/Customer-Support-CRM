import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import RootNotFound from "./not-found";

describe("RootNotFound (portal, Story 96)", () => {
  it("renders a static, locale-agnostic not-found message with a link to the default locale", () => {
    render(<RootNotFound />);

    expect(screen.getByText("Page not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go back home" })).toHaveAttribute("href", "/en");
  });
});
