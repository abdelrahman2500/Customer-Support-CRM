import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Board, BoardColumn } from "./board";

/** Story 211 (PR-1.2) — board layout (no drag-and-drop logic). */
const spine = { border: "border-info-solid", dot: "bg-info-solid" };

describe("Board", () => {
  it("is a labelled region that scrolls horizontally in its own box", () => {
    render(<Board aria-label="Tickets board" />);
    const region = screen.getByRole("region", { name: "Tickets board" });
    expect(region).toHaveClass("overflow-x-auto");
  });

  it("renders a column with its status spine, heading and count", () => {
    render(
      <BoardColumn title="Open" count={42} spine={spine} aria-label="Open, 42 tickets">
        <article>card</article>
      </BoardColumn>,
    );
    const column = screen.getByRole("region", { name: "Open, 42 tickets" });
    expect(column).toHaveClass("border-t-[3px]", "border-info-solid");
    expect(screen.getByRole("heading", { level: 2, name: "Open" })).toBeInTheDocument();
    expect(screen.getByText("42")).toHaveClass("tabular-nums");
  });

  it("collapses to a rail that expands from a named button", () => {
    const onExpand = vi.fn();
    render(
      <BoardColumn
        title="Closed"
        count={5}
        spine={spine}
        collapsed
        onExpand={onExpand}
        expandLabel="Show Closed (5)"
      />,
    );
    const toggle = screen.getByRole("button", { name: "Show Closed (5)" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(onExpand).toHaveBeenCalledOnce();
  });

  it("passes body props to the scrolling body", () => {
    render(
      <BoardColumn title="Open" spine={spine} bodyProps={{ "aria-label": "Open tickets" } as never}>
        <p>x</p>
      </BoardColumn>,
    );
    expect(screen.getByLabelText("Open tickets")).toHaveClass("overflow-y-auto");
  });
});
