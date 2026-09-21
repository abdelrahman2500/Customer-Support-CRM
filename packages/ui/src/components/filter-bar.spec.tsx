import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterBar, FilterSelect } from "./filter-bar";

describe("FilterBar", () => {
  it("stacks below sm and goes inline from sm up", () => {
    const { container } = render(<FilterBar />);
    const bar = container.firstElementChild as HTMLElement;

    expect(bar).toHaveClass("flex-col");
    expect(bar).toHaveClass("sm:flex-row");
    expect(bar).toHaveClass("sm:flex-wrap");
  });

  it("merges a caller className", () => {
    const { container } = render(<FilterBar className="mt-stack" />);
    expect(container.firstElementChild).toHaveClass("mt-stack");
  });
});

describe("FilterSelect", () => {
  const base = {
    label: "Status",
    options: ["OPEN", "CLOSED"] as const,
    allValue: "__all__",
    allLabel: "All",
  };

  it("labels the trigger so it is reachable by its visible label", () => {
    render(<FilterSelect {...base} value="__all__" onChange={vi.fn()} />);

    expect(screen.getByRole("combobox", { name: "Status" })).toBeInTheDocument();
  });

  it("offers the all-option plus every supplied option", async () => {
    const user = userEvent.setup();
    render(<FilterSelect {...base} value="__all__" onChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox", { name: "Status" }));

    expect(await screen.findByRole("option", { name: "All" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "OPEN" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "CLOSED" })).toBeInTheDocument();
  });

  it("reports the chosen value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FilterSelect {...base} value="__all__" onChange={onChange} />);

    await user.click(screen.getByRole("combobox", { name: "Status" }));
    await user.click(await screen.findByRole("option", { name: "OPEN" }));

    expect(onChange).toHaveBeenCalledWith("OPEN");
  });

  it("renders option labels through renderLabel when given", async () => {
    const user = userEvent.setup();
    render(
      <FilterSelect
        {...base}
        value="__all__"
        onChange={vi.fn()}
        renderLabel={(v) => `status:${v.toLowerCase()}`}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Status" }));
    expect(await screen.findByRole("option", { name: "status:open" })).toBeInTheDocument();
  });

  it("goes full-width below sm so it stays tappable on a phone", () => {
    render(<FilterSelect {...base} value="__all__" onChange={vi.fn()} />);

    const trigger = screen.getByRole("combobox", { name: "Status" });
    expect(trigger).toHaveClass("w-full");
    expect(trigger).toHaveClass("sm:w-auto");
  });

  it("uses no physical-direction utility, so it is correct under RTL", () => {
    const { container } = render(<FilterSelect {...base} value="__all__" onChange={vi.fn()} />);
    expect(container.innerHTML).not.toMatch(/\b(ml|mr|pl|pr|text-left|text-right)-/);
  });
});
