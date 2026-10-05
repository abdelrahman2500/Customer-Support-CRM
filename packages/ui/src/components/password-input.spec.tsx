import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { PasswordInput, PasswordToggle } from "./password-input";
import { FormField } from "./form-field";

/** Story 214 (PR-2.2) — a password field with a show/hide toggle that stays
 * outside the field's label. */
function Field() {
  const [visible, setVisible] = useState(false);
  return (
    <FormField
      label="Password"
      action={
        <PasswordToggle
          visible={visible}
          onVisibleChange={setVisible}
          showLabel="Show password"
          hideLabel="Hide password"
        />
      }
    >
      <PasswordInput visible={visible} defaultValue="s3cret" />
    </FormField>
  );
}

describe("PasswordInput", () => {
  it("is named by its field label alone — the toggle is not part of the name", () => {
    render(<Field />);
    // A password input has no ARIA role; assert its computed name directly.
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveAccessibleName("Password");
    expect(screen.getAllByLabelText("Password")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Show password" }).closest("label")).toBeNull();
  });

  it("toggles visibility with a named, pressed-state button that never submits", () => {
    render(<Field />);
    const toggle = screen.getByRole("button", { name: "Show password" });
    expect(toggle).toHaveAttribute("type", "button");
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(toggle);
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    const hide = screen.getByRole("button", { name: "Hide password" });
    expect(hide).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(hide);
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });
});
