import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorState } from "./error-state";

/** Story 199 (RD-2.5) — the shared error / not-found presentation. */
describe("ErrorState", () => {
  it("renders the title as an h2 by default, with the description", () => {
    render(<ErrorState title="Couldn't load" description="Try again in a moment." />);

    const heading = screen.getByRole("heading", { level: 2, name: "Couldn't load" });
    expect(heading).toHaveClass("text-heading");
    expect(screen.getByText("Try again in a moment.")).toBeInTheDocument();
  });

  it("renders the page's h1 at the title step when it is the page", () => {
    render(<ErrorState title="Page not found" headingLevel={1} />);

    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toHaveClass(
      "text-title",
    );
  });

  it("puts recovery actions before the way back, in one wrapping row", () => {
    render(
      <ErrorState
        title="Couldn't load"
        actions={<button type="button">Try again</button>}
        back={<a href="/tickets">Back to tickets</a>}
      />,
    );

    const retry = screen.getByRole("button", { name: "Try again" });
    const back = screen.getByRole("link", { name: "Back to tickets" });
    expect(retry.parentElement).toBe(back.parentElement);
    expect(retry.parentElement).toHaveClass("flex-wrap");
    expect(retry.compareDocumentPosition(back) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders no actions row when there is nothing to do", () => {
    const { container } = render(<ErrorState title="Couldn't load" />);
    expect(container.querySelectorAll("button, a")).toHaveLength(0);
    expect(container.querySelector(".flex-wrap")).toBeNull();
  });

  it("uses a decorative danger icon by default and a neutral one for not-found", () => {
    const { container, rerender } = render(<ErrorState title="x" />);
    let chip = container.querySelector('[aria-hidden="true"]')!;
    expect(chip).toHaveClass("bg-danger-subtle");
    expect(chip.querySelector("svg")).not.toBeNull();

    rerender(<ErrorState title="x" tone="neutral" />);
    chip = container.querySelector('[aria-hidden="true"]')!;
    expect(chip).toHaveClass("bg-surface-muted");
  });

  it("is not a live region by default — a failed page is a page", () => {
    const { container } = render(<ErrorState title="x" />);
    expect(container.querySelector("[role]")).toBeNull();
  });

  it("uses no physical-direction utility", () => {
    const { container } = render(
      <ErrorState title="x" description="d" actions={<span>a</span>} back={<span>b</span>} />,
    );
    expect(container.innerHTML).not.toMatch(/\b(ml|mr|pl|pr|text-left|text-right)-/);
  });
});
