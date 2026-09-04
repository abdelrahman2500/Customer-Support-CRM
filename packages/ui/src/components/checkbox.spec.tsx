import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Checkbox } from "./checkbox";
import { Label } from "./label";

describe("Checkbox", () => {
  it("exposes the checkbox role and its checked state", () => {
    render(<Checkbox aria-label="Include closed" checked />);

    expect(screen.getByRole("checkbox", { name: "Include closed" })).toBeChecked();
  });

  it("toggles on click", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [checked, setChecked] = useState(false);
      return (
        <Checkbox
          aria-label="Include closed"
          checked={checked}
          onCheckedChange={(v) => setChecked(v === true)}
        />
      );
    }
    render(<Harness />);

    const box = screen.getByRole("checkbox", { name: "Include closed" });
    expect(box).not.toBeChecked();
    await user.click(box);
    expect(box).toBeChecked();
  });

  /** Space is the platform activation key for a checkbox; a div-with-onClick
   * substitute would not honour it. */
  it("toggles on Space when focused", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Checkbox aria-label="Include closed" onCheckedChange={onCheckedChange} />);

    await user.tab();
    expect(screen.getByRole("checkbox", { name: "Include closed" })).toHaveFocus();
    await user.keyboard(" ");
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  /** The reason this is Radix rather than a styled native input: a future
   * "select all" header needs a third state, reported as aria-checked=mixed. */
  it("reports the indeterminate state as mixed", () => {
    render(<Checkbox aria-label="Select all" checked="indeterminate" />);

    expect(screen.getByRole("checkbox", { name: "Select all" })).toHaveAttribute(
      "aria-checked",
      "mixed",
    );
  });

  it("cannot be toggled when disabled", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Checkbox aria-label="Include closed" disabled onCheckedChange={onCheckedChange} />);

    await user.click(screen.getByRole("checkbox", { name: "Include closed" }));
    expect(onCheckedChange).not.toHaveBeenCalled();
    expect(screen.getByRole("checkbox", { name: "Include closed" })).toBeDisabled();
  });

  it("is nameable by a Label via htmlFor", () => {
    render(
      <>
        <Label htmlFor="closed">Include closed tickets</Label>
        <Checkbox id="closed" />
      </>,
    );

    expect(screen.getByRole("checkbox", { name: "Include closed tickets" })).toBeInTheDocument();
  });

  it("carries the shared focus-ring utility", () => {
    render(<Checkbox aria-label="x" />);

    expect(screen.getByRole("checkbox")).toHaveClass("focus-ring");
  });
});
