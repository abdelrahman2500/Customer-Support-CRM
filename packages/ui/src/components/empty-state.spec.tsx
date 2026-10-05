import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./button";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("renders a title on its own", () => {
    render(<EmptyState title="No tickets yet." />);

    expect(screen.getByText("No tickets yet.")).toBeInTheDocument();
  });

  it("renders a description alongside the title", () => {
    render(
      <EmptyState
        title="No tickets yet."
        description="Tickets created by customers will appear here."
      />,
    );

    expect(screen.getByText("No tickets yet.")).toBeInTheDocument();
    expect(screen.getByText("Tickets created by customers will appear here.")).toBeInTheDocument();
  });

  it("hides a decorative icon from assistive technology", () => {
    render(<EmptyState title="No tickets yet." icon={<svg data-testid="glyph" />} />);

    const wrapper = screen.getByTestId("glyph").parentElement;
    expect(wrapper).toHaveAttribute("aria-hidden", "true");
  });

  it("renders an action and activates it by click", async () => {
    const onClick = vi.fn();
    render(
      <EmptyState title="No articles yet." action={<Button onClick={onClick}>Create</Button>} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("activates its action from the keyboard", async () => {
    const onClick = vi.fn();
    render(
      <EmptyState title="No articles yet." action={<Button onClick={onClick}>Create</Button>} />,
    );

    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Create" })).toHaveFocus();

    await userEvent.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledOnce();

    await userEvent.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("does not inject a heading into the host page's outline", () => {
    render(<EmptyState title="No tickets yet." />);

    // A `<p>`, deliberately — see the component's own note.
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});

describe("EmptyState design-language surface (Story 187)", () => {
  it("sits on the surface radius and puts its icon in an aria-hidden tinted disc", () => {
    const { container } = render(
      <EmptyState title="No tickets yet." icon={<svg data-testid="glyph" />} />,
    );
    expect(container.firstElementChild).toHaveClass("rounded-surface", "px-6", "py-10");
    const disc = screen.getByTestId("glyph").parentElement;
    // Story 212 (PR-1.3) — the panel itself is now tinted, so the disc sits
    // on the surface with a hairline to stay distinct from it.
    expect(disc).toHaveClass("rounded-pill", "bg-surface", "ring-rule");
    expect(disc).toHaveAttribute("aria-hidden", "true");
  });

  // Story 212 (PR-1.3) — v2: a quiet tinted panel, not a dashed drop-zone box.
  it("renders as a quiet tinted panel without a dashed border", () => {
    const { container } = render(<EmptyState title="Nothing here" />);
    expect(container.firstElementChild).toHaveClass("bg-surface-muted/60");
    expect(container.firstElementChild).not.toHaveClass("border-dashed");
  });
});
