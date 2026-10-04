import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "./badge";

/**
 * Story S-5 — `Badge` had no coverage of its own, which mattered once it
 * became the shared vocabulary that five duplicated app-side status maps
 * now resolve against. The variant assertions pin the semantic set in
 * place; the palette assertions pin each variant to its S-1 token family
 * rather than to a raw slate/emerald/amber step.
 *
 * Deliberately no domain mapping tested here: which tone `OPEN` gets is
 * `@crm/shared`'s `ticket-presentation.ts` (Story 191), tested in
 * `apps/web/src/lib/ticket-presentation.spec.ts` and the apps' ticket badge
 * specs.
 */
describe("Badge", () => {
  it("renders its content", () => {
    render(<Badge>OPEN</Badge>);

    expect(screen.getByText("OPEN")).toBeInTheDocument();
  });

  it("exposes the full semantic variant set", () => {
    for (const variant of [
      "default",
      "secondary",
      "outline",
      "success",
      "warning",
      "destructive",
      "info",
    ] as const) {
      const { unmount } = render(<Badge variant={variant}>x</Badge>);
      expect(screen.getByText("x")).toBeInTheDocument();
      unmount();
    }
  });

  it("takes every variant's colour from an S-1 semantic token family", () => {
    const cases = [
      ["default", "bg-accent", "text-accent-foreground"],
      ["secondary", "bg-surface-muted", "text-ink"],
      ["success", "bg-success-surface", "text-success-foreground"],
      ["warning", "bg-warning-surface", "text-warning-foreground"],
      ["destructive", "bg-danger-surface", "text-danger-foreground"],
      ["info", "bg-info-surface", "text-info-foreground"],
    ] as const;

    for (const [variant, background, foreground] of cases) {
      const { container, unmount } = render(<Badge variant={variant}>x</Badge>);
      const element = container.firstElementChild as HTMLElement;
      expect(element, variant).toHaveClass(background);
      expect(element, variant).toHaveClass(foreground);
      unmount();
    }
  });

  it("gives the outline variant a rule border instead of a fill", () => {
    const { container } = render(<Badge variant="outline">x</Badge>);

    const element = container.firstElementChild as HTMLElement;
    expect(element).toHaveClass("border-rule-strong");
    expect(element).toHaveClass("text-ink-strong");
  });

  it("defaults to the default variant", () => {
    const { container } = render(<Badge>x</Badge>);

    expect(container.firstElementChild).toHaveClass("bg-accent");
  });

  it("is an inline span, so it flows with the text it annotates", () => {
    const { container } = render(<Badge>x</Badge>);

    const element = container.firstElementChild as HTMLElement;
    expect(element.tagName).toBe("SPAN");
    expect(element).toHaveClass("inline-flex");
  });

  it("merges a caller className and spreads other span props", () => {
    render(
      <Badge className="ms-2" data-testid="b" title="Ticket status">
        x
      </Badge>,
    );

    const element = screen.getByTestId("b");
    expect(element).toHaveClass("ms-2");
    expect(element).toHaveClass("rounded-pill");
    expect(element).toHaveAttribute("title", "Ticket status");
  });
});

describe("Badge design-language API (Story 185)", () => {
  it("offers the progress tone", () => {
    const { container } = render(<Badge variant="progress">In progress</Badge>);
    expect(container.firstElementChild).toHaveClass("bg-progress-surface", "text-progress-foreground");
  });

  it("renders a decorative leading icon before the label", () => {
    const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon" {...props} />;
    render(<Badge icon={Icon as never}>Open</Badge>);
    const icon = screen.getByTestId("icon");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon.nextSibling?.textContent).toBe("Open");
  });

  it("offers a small size", () => {
    const { container } = render(<Badge size="sm">x</Badge>);
    expect(container.firstElementChild).toHaveClass("text-caption");
  });
});
