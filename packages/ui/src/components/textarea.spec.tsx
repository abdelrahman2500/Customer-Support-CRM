import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Label } from "./label";
import { Textarea } from "./textarea";

describe("Textarea", () => {
  it("accepts typed input", async () => {
    const user = userEvent.setup();
    render(<Textarea aria-label="Note" />);

    await user.type(screen.getByRole("textbox", { name: "Note" }), "hello");
    expect(screen.getByRole("textbox", { name: "Note" })).toHaveValue("hello");
  });

  it("is labelable through Label + htmlFor", () => {
    render(
      <>
        <Label htmlFor="body">Body</Label>
        <Textarea id="body" />
      </>,
    );

    expect(screen.getByRole("textbox", { name: "Body" })).toBeInTheDocument();
  });

  it("blocks input and reports disabled when disabled", async () => {
    const user = userEvent.setup();
    render(<Textarea aria-label="Note" disabled />);

    const textarea = screen.getByRole("textbox", { name: "Note" });
    expect(textarea).toBeDisabled();
    await user.type(textarea, "nope");
    expect(textarea).toHaveValue("");
  });

  /** Same focus treatment as every other control, so a form does not have
   * one field that focuses differently from its neighbours. */
  it("uses the shared focus-ring utility", () => {
    render(<Textarea aria-label="Note" />);

    expect(screen.getByRole("textbox", { name: "Note" })).toHaveClass("focus-ring");
  });

  it("supports error styling through aria-invalid without hard-coding it", () => {
    render(<Textarea aria-label="Note" aria-invalid />);

    expect(screen.getByRole("textbox", { name: "Note" })).toHaveAttribute("aria-invalid", "true");
  });

  it("matches Input's token vocabulary rather than raw palette classes", () => {
    render(<Textarea aria-label="Note" />);

    const textarea = screen.getByRole("textbox", { name: "Note" });
    expect(textarea).toHaveClass("border-rule-strong");
    expect(textarea).toHaveClass("bg-surface");
    expect(textarea.className).not.toMatch(/slate-\d/);
  });
});
