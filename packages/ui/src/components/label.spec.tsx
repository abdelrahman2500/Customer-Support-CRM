import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "./input";
import { Label } from "./label";

describe("Label", () => {
  it("names the control it points at", () => {
    render(
      <>
        <Label htmlFor="email">Email address</Label>
        <Input id="email" />
      </>,
    );

    expect(screen.getByRole("textbox", { name: "Email address" })).toBeInTheDocument();
  });

  /** The behaviour a plain `<label>` wrapper around a composite widget does
   * not give you — the reason this is Radix's Label (recon H-4). */
  it("moves focus to the control when clicked", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Label htmlFor="subject">Subject</Label>
        <Input id="subject" />
      </>,
    );

    await user.click(screen.getByText("Subject"));
    expect(screen.getByRole("textbox", { name: "Subject" })).toHaveFocus();
  });

  it("renders a label element", () => {
    render(<Label htmlFor="x">Name</Label>);

    expect(screen.getByText("Name").tagName).toBe("LABEL");
  });
});
