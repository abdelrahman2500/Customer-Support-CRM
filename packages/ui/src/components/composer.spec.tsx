import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { createRef, useState } from "react";
import { Composer, type ComposerProps } from "./composer";

/** Story 207 (RD-3.7, recon A11Y-05/A11Y-09) — the composer shell. */
function Harness(props: Partial<ComposerProps> & { initial?: string }) {
  const { initial = "hello", ...rest } = props;
  const [value, setValue] = useState(initial);
  return (
    <Composer
      label="Reply to the customer"
      placeholder="Type a message..."
      value={value}
      onValueChange={setValue}
      onSubmit={vi.fn()}
      submitLabel="Send"
      canSubmit={value.trim().length > 0}
      {...rest}
    />
  );
}

function field() {
  return screen.getByLabelText("Reply to the customer") as HTMLTextAreaElement;
}

describe("Composer", () => {
  it("names the field by its label, not its placeholder", () => {
    render(<Harness />);
    expect(screen.getByRole("textbox", { name: "Reply to the customer" })).toHaveAttribute(
      "placeholder",
      "Type a message...",
    );
  });

  it("submits on Enter and adds a line on Shift+Enter", () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    fireEvent.keyDown(field(), { key: "Enter", shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.keyDown(field(), { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("never submits on an Enter that belongs to an IME composition", () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} initial="مرحب" />);

    fireEvent.compositionStart(field());
    // The confirming Enter of the composition, however the browser flags it.
    fireEvent.keyDown(field(), { key: "Enter", isComposing: true });
    fireEvent.keyDown(field(), { key: "Enter", keyCode: 229 });
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.compositionEnd(field());
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("does not submit when it can't, by Enter or by the button", () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} initial="   " />);

    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    fireEvent.keyDown(field(), { key: "Enter" });
    fireEvent.submit(field().closest("form")!);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("keeps the field enabled while pending and marks the form busy", () => {
    render(<Harness pending canSubmit={false} submitLabel="Sending..." />);

    expect(field()).toBeEnabled();
    expect(field().closest("form")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Sending..." })).toBeDisabled();
  });

  it("returns focus to the field after a submit from the button", async () => {
    let resolve!: () => void;
    const onSubmit = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    render(<Harness onSubmit={onSubmit} />);

    const button = screen.getByRole("button", { name: "Send" });
    button.focus();
    fireEvent.click(button);
    expect(onSubmit).toHaveBeenCalledOnce();

    await act(async () => resolve());
    expect(field()).toHaveFocus();
  });

  it("hands the caller a ref to the field", () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<Harness textareaRef={ref} />);
    expect(ref.current).toBe(field());
  });

  it("tints the field as an internal note", () => {
    render(<Harness tone="note" />);
    expect(field()).toHaveClass("border-warning-border", "bg-warning-subtle");
  });

  describe("suggestions", () => {
    const options = [
      { id: "u1", label: "Jane Doe" },
      { id: "u2", label: "John Smith" },
    ];

    function renderWithSuggestions(list = options) {
      const onPick = vi.fn();
      const onDismiss = vi.fn();
      const onSubmit = vi.fn();
      render(
        <Harness
          initial="@J"
          onSubmit={onSubmit}
          suggestions={{ label: "Agents to mention", options: list, onPick, onDismiss }}
        />,
      );
      return {
        onPick,
        onDismiss,
        onSubmit,
        box: screen.getByRole("combobox", { name: "Reply to the customer" }),
      };
    }

    it("exposes the combobox pattern over a named listbox", () => {
      const { box } = renderWithSuggestions();

      const listbox = screen.getByRole("listbox", { name: "Agents to mention" });
      expect(box).toHaveAttribute("aria-expanded", "true");
      expect(box).toHaveAttribute("aria-controls", listbox.id);
      expect(box).toHaveAttribute("aria-autocomplete", "list");
      const [first] = screen.getAllByRole("option");
      expect(box).toHaveAttribute("aria-activedescendant", first!.id);
      expect(first).toHaveAttribute("aria-selected", "true");
    });

    it("moves with the arrow keys, wrapping, and picks with Enter instead of submitting", () => {
      const { box, onPick, onSubmit } = renderWithSuggestions();
      const [first, second] = screen.getAllByRole("option");

      fireEvent.keyDown(box, { key: "ArrowDown" });
      expect(box).toHaveAttribute("aria-activedescendant", second!.id);
      fireEvent.keyDown(box, { key: "ArrowDown" });
      expect(box).toHaveAttribute("aria-activedescendant", first!.id);
      fireEvent.keyDown(box, { key: "ArrowUp" });
      expect(box).toHaveAttribute("aria-activedescendant", second!.id);

      fireEvent.keyDown(box, { key: "Enter" });
      expect(onPick).toHaveBeenCalledWith("u2");
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("picks with Tab or a click, and dismisses on Escape", () => {
      const { box, onPick, onDismiss } = renderWithSuggestions();

      fireEvent.keyDown(box, { key: "Tab" });
      expect(onPick).toHaveBeenLastCalledWith("u1");

      fireEvent.click(screen.getByRole("option", { name: "John Smith" }));
      expect(onPick).toHaveBeenLastCalledWith("u2");

      fireEvent.keyDown(box, { key: "Escape" });
      expect(onDismiss).toHaveBeenCalledOnce();
    });

    it("is collapsed with no options, and Enter submits again", () => {
      const { box, onSubmit } = renderWithSuggestions([]);

      expect(box).toHaveAttribute("aria-expanded", "false");
      expect(box).not.toHaveAttribute("aria-activedescendant");
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      fireEvent.keyDown(box, { key: "Enter" });
      expect(onSubmit).toHaveBeenCalledOnce();
    });
  });
});
