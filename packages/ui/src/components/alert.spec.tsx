import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Alert } from "./alert";

/**
 * Story S-4 — the behaviour under test is the live-region role, which is
 * the only thing this story changed about `Alert`. The variant assertions
 * exist to pin the visual palettes in place while that changed.
 */
describe("Alert", () => {
  it("announces a destructive alert assertively", () => {
    render(<Alert variant="destructive">Could not save the ticket.</Alert>);

    // role="alert" carries an implicit aria-live="assertive" — a failure
    // should interrupt.
    expect(screen.getByRole("alert")).toHaveTextContent("Could not save the ticket.");
  });

  it("announces success politely, not assertively", () => {
    render(<Alert variant="success">Ticket created.</Alert>);

    expect(screen.getByRole("status")).toHaveTextContent("Ticket created.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("announces the default/informational variant politely", () => {
    render(<Alert>Two agents are editing this ticket.</Alert>);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("lets a caller override the role for a genuinely urgent notice", () => {
    render(
      <Alert variant="default" role="alert">
        Your session expires in 30 seconds.
      </Alert>,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("keeps every variant's palette", () => {
    const cases = [
      ["default", "bg-surface-sunk"],
      ["destructive", "bg-danger-subtle"],
      ["success", "bg-success-subtle"],
    ] as const;

    for (const [variant, expected] of cases) {
      const { container, unmount } = render(<Alert variant={variant}>x</Alert>);
      expect(container.firstElementChild).toHaveClass(expected);
      unmount();
    }
  });

  it("merges a caller className and spreads other div props", () => {
    render(
      <Alert className="flex items-center justify-between" data-testid="a">
        x
      </Alert>,
    );

    const element = screen.getByTestId("a");
    expect(element).toHaveClass("flex");
    // Base classes survive the merge.
    expect(element).toHaveClass("rounded-md");
  });
});
