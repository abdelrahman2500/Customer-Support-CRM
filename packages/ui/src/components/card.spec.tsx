import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  SectionCard,
} from "./card";

describe("Card", () => {
  it("composes into a titled, described, footed card", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>SLA policies</CardTitle>
          <CardDescription>Applied to new tickets automatically.</CardDescription>
        </CardHeader>
        <CardContent>Two policies active.</CardContent>
        <CardFooter>Footer action</CardFooter>
      </Card>,
    );

    expect(screen.getByRole("heading", { name: "SLA policies" })).toBeInTheDocument();
    expect(screen.getByText("Applied to new tickets automatically.")).toBeInTheDocument();
    expect(screen.getByText("Two policies active.")).toBeInTheDocument();
    expect(screen.getByText("Footer action")).toBeInTheDocument();
  });

  /** `CardTitle` must be a real heading, not a styled div — the recon found
   * three detail views with no heading at all, and this primitive is what
   * later stories build their page structure from. */
  it("renders the title as a heading element", () => {
    render(<CardTitle>Reports</CardTitle>);

    expect(screen.getByRole("heading", { name: "Reports" }).tagName).toBe("H3");
  });

  /** The 44 hand-rolled cards are `rounded-md border bg-white p-4`. Card +
   * CardContent has to reproduce exactly that so a later migration is a
   * no-op visually. */
  it("Card + CardContent reproduces the existing hand-rolled card shape", () => {
    const { container } = render(
      <Card>
        <CardContent>body</CardContent>
      </Card>,
    );

    const card = container.firstElementChild as HTMLElement;
    // Story 139 — the chrome now comes from the Story 134 tokens. Each is
    // value-identical to the class it replaced: --radius-surface is
    // 0.375rem (rounded-md) and --space-surface is 1rem (p-4).
    expect(card).toHaveClass("rounded-surface");
    expect(card).toHaveClass("border");
    expect(card).toHaveClass("border-rule");
    expect(card).toHaveClass("bg-surface");
    // Padding lives on the section, not the container.
    expect(card).not.toHaveClass("p-surface");
    expect(card.firstElementChild).toHaveClass("p-surface");
  });

  it("is flat by default and can be raised for emphasis", () => {
    const { container: flat } = render(<Card />);
    expect(flat.firstElementChild).not.toHaveClass("shadow-resting");

    const { container: raised } = render(<Card elevation="raised" />);
    expect(raised.firstElementChild).toHaveClass("shadow-resting");
  });

  it("merges a caller className over the base classes", () => {
    const { container } = render(<Card className="bg-surface-sunk" />);

    const card = container.firstElementChild as HTMLElement;
    expect(card).toHaveClass("bg-surface-sunk");
    expect(card).not.toHaveClass("bg-surface");
  });
});

/**
 * Story 154 — `CardTitle`'s heading level, and the section-card composition
 * built on it.
 *
 * The component shipped in Story S-3 rendering a hard `h3` and reached zero
 * consumers: 49 section headings across both apps need `h2` (they sit under
 * a page-level `PageHeader` `h1`), so adopting it would have skipped a
 * heading level. These pin the fix.
 */
describe("CardTitle heading level (Story 154)", () => {
  it("still renders an h3 by default, so existing callers are unaffected", () => {
    render(<CardTitle>Section</CardTitle>);

    expect(screen.getByRole("heading", { level: 3, name: "Section" })).toBeInTheDocument();
  });

  it("renders the requested heading level", () => {
    const { rerender } = render(<CardTitle as="h2">Section</CardTitle>);
    expect(screen.getByRole("heading", { level: 2, name: "Section" })).toBeInTheDocument();

    rerender(<CardTitle as="h4">Section</CardTitle>);
    expect(screen.getByRole("heading", { level: 4, name: "Section" })).toBeInTheDocument();
  });

  it("keeps its token classes at every level", () => {
    render(<CardTitle as="h2">Section</CardTitle>);

    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toHaveClass("text-sm", "font-semibold", "text-ink");
    // Never a raw palette class — the repo's token guards forbid it.
    expect(heading.className).not.toMatch(/text-(slate|gray|zinc)-\d{3}/);
  });

  it("merges a caller's className rather than dropping it", () => {
    render(
      <CardTitle as="h2" className="mt-2">
        Section
      </CardTitle>,
    );

    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toHaveClass("mt-2", "font-semibold");
  });
});

describe("SectionCard (Story 154)", () => {
  it("renders the title as an h2 by default", () => {
    render(<SectionCard title="Notes">body</SectionCard>);

    expect(screen.getByRole("heading", { level: 2, name: "Notes" })).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  it("reproduces the hand-written shape exactly, adding no DOM node", () => {
    // Story 139 chose `<Card className="p-surface">` over
    // `<Card><CardContent>` precisely to avoid an extra node, because
    // `.closest()` selectors and heading structure depend on the count.
    // Without `actions`, this must stay: card > (heading, …children).
    const { container } = render(<SectionCard title="Notes">body</SectionCard>);

    const card = container.firstElementChild!;
    expect(card).toHaveClass("rounded-surface", "border", "bg-surface", "p-surface");
    expect(card.firstElementChild!.tagName).toBe("H2");
  });

  it("puts actions on the heading row without disturbing the heading", () => {
    render(
      <SectionCard title="Notes" actions={<button type="button">Add</button>}>
        body
      </SectionCard>,
    );

    expect(screen.getByRole("heading", { level: 2, name: "Notes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  });

  it("honours an explicit heading level for a nested section", () => {
    render(
      <SectionCard title="Nested" headingLevel="h3">
        body
      </SectionCard>,
    );

    expect(screen.getByRole("heading", { level: 3, name: "Nested" })).toBeInTheDocument();
  });

  it("passes elevation and className through to the card", () => {
    const { container } = render(
      <SectionCard title="Notes" elevation="raised" className="mt-4">
        body
      </SectionCard>,
    );

    expect(container.firstElementChild).toHaveClass("shadow-resting", "mt-4");
  });

  it("uses no physical-direction utility, so it is correct under RTL", () => {
    const { container } = render(
      <SectionCard title="Notes" actions={<button type="button">Add</button>}>
        body
      </SectionCard>,
    );

    expect(container.innerHTML).not.toMatch(/\b(ml|mr|pl|pr|text-left|text-right)-/);
  });
});
