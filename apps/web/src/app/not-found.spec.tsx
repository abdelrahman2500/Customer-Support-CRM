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

  /**
   * Story 176 — Story 170 put every page title on the named `title` step and
   * scoped itself to `PageHeader`/`CardTitle` plus three detail views, which
   * left the six error/not-found shells at `text-xl`. The product rendered
   * page titles at two sizes; this pins the one that is correct.
   *
   * `font-semibold` is deliberately absent: the `title` step declares
   * `fontWeight: 600` in its own `fontSize` tuple, so stating it twice is how
   * the two drift apart later — the same reasoning Story 170 recorded.
   *
   * Class-level because jsdom loads no Tailwind CSS; the rendered size is
   * confirmed in a browser instead.
   */
  it("types the heading at the named title step, not the old text-xl", () => {
    render(<RootNotFound />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveClass("text-title");
    expect(heading).not.toHaveClass("text-xl");
    expect(heading).not.toHaveClass("font-semibold");
  });
});
