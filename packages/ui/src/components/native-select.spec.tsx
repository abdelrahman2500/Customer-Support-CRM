import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NativeSelect } from "./native-select";

const OPTIONS = [
  { value: "en", label: "English" },
  { value: "ar", label: "العربية" },
];

describe("NativeSelect", () => {
  it("renders a named native combobox with its options", () => {
    render(<NativeSelect aria-label="Language" options={OPTIONS} value="en" onValueChange={vi.fn()} />);
    const select = screen.getByRole("combobox", { name: "Language" });
    expect(select.tagName).toBe("SELECT");
    expect(screen.getByRole("option", { name: "العربية" })).toBeInTheDocument();
    expect(select).toHaveValue("en");
  });

  it("reports the chosen value", async () => {
    const onValueChange = vi.fn();
    render(<NativeSelect aria-label="Language" options={OPTIONS} value="en" onValueChange={onValueChange} />);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Language" }), "ar");
    expect(onValueChange).toHaveBeenCalledWith("ar");
  });

  it("uses the design tokens: focus ring, control radius and a ≥3:1 control border", () => {
    render(<NativeSelect aria-label="Language" options={OPTIONS} value="en" onValueChange={vi.fn()} />);
    const select = screen.getByRole("combobox", { name: "Language" });
    expect(select).toHaveClass("focus-ring", "rounded-control", "border-rule-control", "h-8");
  });

  it("offers a 40px comfortable size", () => {
    render(
      <NativeSelect aria-label="Branch" size="md" options={OPTIONS} value="en" onValueChange={vi.fn()} />,
    );
    expect(screen.getByRole("combobox", { name: "Branch" })).toHaveClass("h-10");
  });
});
