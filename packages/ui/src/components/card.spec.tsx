import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";

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
    expect(card).toHaveClass("rounded-md");
    expect(card).toHaveClass("border");
    expect(card).toHaveClass("border-rule");
    expect(card).toHaveClass("bg-surface");
    // Padding lives on the section, not the container.
    expect(card).not.toHaveClass("p-4");
    expect(card.firstElementChild).toHaveClass("p-4");
  });

  it("is flat by default and can be raised for emphasis", () => {
    const { container: flat } = render(<Card />);
    expect(flat.firstElementChild).not.toHaveClass("shadow-sm");

    const { container: raised } = render(<Card elevation="raised" />);
    expect(raised.firstElementChild).toHaveClass("shadow-sm");
  });

  it("merges a caller className over the base classes", () => {
    const { container } = render(<Card className="bg-surface-sunk" />);

    const card = container.firstElementChild as HTMLElement;
    expect(card).toHaveClass("bg-surface-sunk");
    expect(card).not.toHaveClass("bg-surface");
  });
});
