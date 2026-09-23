import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageHeader } from "./page-header";

describe("PageHeader", () => {
  it("renders the title as the page's single level-1 heading", () => {
    render(<PageHeader title="Tickets" />);

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("Tickets");
  });

  /**
   * Story 170 — the page title spends Story 134's `title` step (1.5rem/600)
   * instead of the `text-lg font-semibold` pair Story 140 froze. The negative
   * assertion pins the migration, not just the current class.
   */
  it("types the page title at the named title step", () => {
    render(<PageHeader title="Tickets" />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveClass("text-title", "text-ink");
    expect(heading).not.toHaveClass("text-lg");
  });

  it("renders inside a header landmark", () => {
    render(<PageHeader title="Tickets" />);

    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("renders a description only when one is given", () => {
    const { rerender, container } = render(<PageHeader title="Tickets" />);
    expect(container.querySelector("p")).toBeNull();

    rerender(<PageHeader title="Tickets" description="Everything assigned to you." />);
    expect(screen.getByText("Everything assigned to you.")).toBeInTheDocument();
  });

  it("renders actions only when given, and keeps them from shrinking", () => {
    const { rerender, container } = render(<PageHeader title="Tickets" />);
    expect(container.querySelector(".shrink-0")).toBeNull();

    rerender(<PageHeader title="Tickets" actions={<button type="button">New</button>} />);
    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
    expect(container.querySelector(".shrink-0")).toBeInTheDocument();
  });

  it("lets a long free-text title shrink instead of pushing actions off-screen", () => {
    const { container } = render(
      <PageHeader
        title="A very long customer name that would otherwise not wrap"
        actions={<span>x</span>}
      />,
    );

    // `min-w-0` is what allows the flex item to go below its content width.
    expect(container.querySelector(".min-w-0")).toBeInTheDocument();
  });

  it("stacks below sm and sits on one row from sm up", () => {
    const { container } = render(<PageHeader title="Tickets" />);
    const header = container.firstElementChild as HTMLElement;

    expect(header).toHaveClass("flex-col");
    expect(header).toHaveClass("sm:flex-row");
    expect(header).toHaveClass("sm:justify-between");
  });

  it("uses no physical-direction utility, so it is correct under RTL", () => {
    const { container } = render(
      <PageHeader title="Tickets" description="d" actions={<span>a</span>} />,
    );

    expect(container.innerHTML).not.toMatch(/\b(ml|mr|pl|pr|text-left|text-right)-/);
  });

  it("merges a caller className", () => {
    const { container } = render(<PageHeader title="Tickets" className="mt-stack" />);
    expect(container.firstElementChild).toHaveClass("mt-stack");
  });
});
