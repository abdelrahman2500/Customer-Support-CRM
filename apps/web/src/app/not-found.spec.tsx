import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import RootNotFound from "./not-found";

/**
 * Story 96 — this boundary supplies its own `<html>`/`<body>` (no ancestor
 * layout renders one — see the file's own doc comment for why), so it has
 * no locale/translation context to mock; a plain render exercises its
 * genuinely static, locale-agnostic fallback content directly.
 */
describe("RootNotFound (Story 96)", () => {
  it("renders a static, locale-agnostic not-found message with a link to the default locale", () => {
    render(<RootNotFound />);

    expect(screen.getByText("Page not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go back home" })).toHaveAttribute("href", "/en");
  });
});
