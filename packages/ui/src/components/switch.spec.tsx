import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Switch } from "./switch";
import { Label } from "./label";

/** Story 211 (PR-1.2) — the ARIA switch. */
function Controlled({ onChange = vi.fn() }: { onChange?: (value: boolean) => void }) {
  const [on, setOn] = useState(false);
  return (
    <>
      <Label htmlFor="email-updates">Email updates</Label>
      <Switch
        id="email-updates"
        checked={on}
        onCheckedChange={(value) => {
          setOn(value);
          onChange(value);
        }}
      />
    </>
  );
}

describe("Switch", () => {
  it("is a switch named by its label, carrying its state", () => {
    render(<Controlled />);
    const toggle = screen.getByRole("switch", { name: "Email updates" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("toggles from the keyboard with Space", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    screen.getByRole("switch").focus();
    await user.keyboard(" ");
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("moves its thumb with a logical margin, so it mirrors in RTL", () => {
    render(<Switch checked aria-label="On" onCheckedChange={vi.fn()} />);
    expect(screen.getByRole("switch").firstElementChild).toHaveClass("ms-5");
  });

  it("does nothing while disabled", () => {
    const onChange = vi.fn();
    render(<Switch checked={false} disabled aria-label="Off" onCheckedChange={onChange} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
