import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatCard } from "./stat-card";

/** Story 211 (PR-1.2) — one KPI. */
describe("StatCard", () => {
  it("shows the label and a tabular display number", () => {
    render(<StatCard label="Assigned to me" value={7} />);
    const value = screen.getByText("7");
    expect(value).toHaveClass("text-display", "tabular-nums");
    expect(screen.getByText("Assigned to me")).toBeInTheDocument();
  });

  it("shows an em dash for an unknown value and a skeleton while loading", () => {
    const { rerender, container } = render(<StatCard label="Breached" value={undefined} />);
    expect(screen.getByText("—")).toBeInTheDocument();
    rerender(<StatCard label="Breached" value={3} loading />);
    expect(screen.queryByText("3")).not.toBeInTheDocument();
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("navigates as the caller's link, keeping one accessible name", () => {
    render(
      <StatCard label="Breached" value={3} hint="SLA" edge="border-danger-solid" asChild>
        <a href="/tickets?view=board">Breached</a>
      </StatCard>,
    );
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/tickets?view=board");
    expect(link).toHaveTextContent("Breached3SLA");
    expect(link).toHaveClass("border-danger-solid", "hover:shadow-raised");
  });

  it("rests flat as a card, without a shadow", () => {
    const { container } = render(<StatCard label="Open" value={1} />);
    expect(container.firstElementChild!.className).not.toMatch(/(^|\s)shadow-/);
  });
});
