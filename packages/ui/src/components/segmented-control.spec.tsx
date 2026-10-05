import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { SegmentedControl, type SegmentedOption } from "./segmented-control";

/** Story 211 (PR-1.2) — a radio group of views. */
const OPTIONS: SegmentedOption[] = [
  { value: "all", label: "All", count: 12 },
  { value: "mine", label: "Mine", count: 3, dot: "bg-info-solid" },
  { value: "unassigned", label: "Unassigned" },
];

function Controlled({ dir }: { dir?: "ltr" | "rtl" }) {
  const [value, setValue] = useState("all");
  return (
    <SegmentedControl
      aria-label="Quick view"
      options={OPTIONS}
      value={value}
      onValueChange={setValue}
      dir={dir}
    />
  );
}

describe("SegmentedControl", () => {
  it("is a named radio group with one tab stop on the checked option", () => {
    render(<Controlled />);
    const group = screen.getByRole("radiogroup", { name: "Quick view" });
    const radios = screen.getAllByRole("radio");
    expect(group).toContainElement(radios[0]!);
    expect(radios[0]).toHaveAttribute("aria-checked", "true");
    expect(radios.map((radio) => radio.tabIndex)).toEqual([0, -1, -1]);
    expect(radios[0]).toHaveTextContent("All12");
  });

  it("moves and selects with arrows, wrapping, plus Home and End", async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    screen.getAllByRole("radio")[0]!.focus();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: /Mine/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /Mine/ })).toHaveFocus();
    await user.keyboard("{End}");
    expect(screen.getByRole("radio", { name: "Unassigned" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: /All/ })).toHaveAttribute("aria-checked", "true");
    await user.keyboard("{Home}{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "Unassigned" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("follows the reading direction: in RTL, ArrowLeft is next", async () => {
    const user = userEvent.setup();
    render(<Controlled dir="rtl" />);
    screen.getAllByRole("radio")[0]!.focus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("radio", { name: /Mine/ })).toHaveAttribute("aria-checked", "true");
  });

  it("selects on click and shows a decorative tone dot", async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    await user.click(screen.getByRole("radio", { name: "Unassigned" }));
    expect(screen.getByRole("radio", { name: "Unassigned" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(
      screen.getByRole("radio", { name: /Mine/ }).querySelector(".bg-info-solid"),
    ).toHaveAttribute("aria-hidden", "true");
  });
});
