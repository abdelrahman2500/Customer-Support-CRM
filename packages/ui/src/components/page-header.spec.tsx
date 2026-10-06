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

  it("isolates the title, which is often user text in the other direction (Story 233)", () => {
    render(<PageHeader title="Invoice for March?" />);

    const heading = screen.getByRole("heading", { level: 1, name: "Invoice for March?" });
    expect(heading.firstElementChild?.tagName).toBe("BDI");
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

  describe("slots (Story 197)", () => {
    function renderAll() {
      return render(
        <PageHeader
          title="Ticket 42"
          description="Opened by Ada"
          back={<a href="/tickets">Back to tickets</a>}
          meta={<span>Open</span>}
          actions={<button type="button">Resolve</button>}
          tabs={<div role="tablist" aria-label="Sections" />}
          className="mt-stack"
        />,
      );
    }

    it("puts back above the title, meta after the description, and tabs after the row", () => {
      const { container } = renderAll();
      const order = [...container.querySelectorAll("a, h1, p, span, button, [role=tablist]")].map(
        (el) =>
          el.tagName.toLowerCase() +
          (el.getAttribute("role") ? `[${el.getAttribute("role")}]` : ""),
      );
      expect(order).toEqual(["a", "h1", "p", "span", "button", "div[tablist]"]);
    });

    it("keeps meta inside the title block, as a wrapping row", () => {
      renderAll();
      const meta = screen.getByText("Open").parentElement!;
      expect(meta).toHaveClass("flex", "flex-wrap");
      expect(meta.parentElement).toContainElement(screen.getByRole("heading", { level: 1 }));
    });

    it("still renders exactly one h1, stacks the regions, and keeps className on the root", () => {
      const { container } = renderAll();
      expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
      const root = container.firstElementChild as HTMLElement;
      expect(root.tagName).toBe("HEADER");
      expect(root).toHaveClass("flex-col", "gap-stack", "mt-stack");
      // The title row inside keeps the responsive row contract.
      expect(root.children[1]).toHaveClass("flex-col", "sm:flex-row", "sm:justify-between");
    });

    it("keeps the pre-slot structure when only meta is added", () => {
      const { container } = render(<PageHeader title="Tickets" meta={<span>12 open</span>} />);
      const root = container.firstElementChild as HTMLElement;
      expect(root).toHaveClass("sm:flex-row");
      expect(root).not.toHaveClass("gap-stack");
    });

    it("uses no physical-direction utility with every slot", () => {
      const { container } = renderAll();
      expect(container.innerHTML).not.toMatch(/\b(ml|mr|pl|pr|text-left|text-right)-/);
    });
  });

  // Story 198 (RD-2.4, recon A11Y-04) — a view hosted under another page's h1.
  describe("headingLevel (Story 198)", () => {
    it("renders an h2 at the heading step, outside any header landmark, at level 2", () => {
      const { container } = render(
        <PageHeader title="Branding" description="d" headingLevel={2} />,
      );
      expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 2, name: "Branding" })).toHaveClass(
        "text-heading",
      );
      expect(container.querySelector("header")).toBeNull();
    });

    it("defaults to the page's h1 in a header landmark", () => {
      const { container } = render(<PageHeader title="Branding" />);
      expect(screen.getByRole("heading", { level: 1, name: "Branding" })).toBeInTheDocument();
      expect(container.querySelector("header")).not.toBeNull();
    });
  });
});
