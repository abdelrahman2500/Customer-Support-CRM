import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FileDropzone } from "./file-dropzone";

/** Story 208 (RD-3.8, recon A11Y-02) — a labelled single-file picker. */
const file = new File(["hello"], "notes.txt", { type: "text/plain" });

describe("FileDropzone", () => {
  it("names the file input by its label and describes it by the hint", () => {
    render(<FileDropzone label="Attach a file" hint="or drop it here" onFile={vi.fn()} />);

    const input = screen.getByLabelText("Attach a file");
    expect(input).toHaveAttribute("type", "file");
    expect(input).toHaveAccessibleDescription("or drop it here");
    // Visually hidden, but the visible wrapper carries the focus ring.
    expect(input).toHaveClass("sr-only");
    expect(input.closest("label")!.className).toContain("has-[:focus-visible]:ring-2");
  });

  it("hands over the picked file and resets the input so it can be picked again", () => {
    const onFile = vi.fn();
    render(<FileDropzone label="Attach a file" onFile={onFile} />);
    const input = screen.getByLabelText("Attach a file") as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    expect(onFile).toHaveBeenCalledWith(file);
    expect(input.value).toBe("");
  });

  it("takes the first dropped file and shows the drag state while over it", () => {
    const onFile = vi.fn();
    render(<FileDropzone label="Attach a file" onFile={onFile} />);
    const zone = screen.getByLabelText("Attach a file").closest("label")!;
    const second = new File(["x"], "second.txt");

    fireEvent.dragOver(zone, { dataTransfer: { files: [file, second] } });
    expect(zone).toHaveAttribute("data-dragging");
    fireEvent.drop(zone, { dataTransfer: { files: [file, second] } });

    expect(onFile).toHaveBeenCalledOnce();
    expect(onFile).toHaveBeenCalledWith(file);
    expect(zone).not.toHaveAttribute("data-dragging");
  });

  it("does nothing while disabled", () => {
    const onFile = vi.fn();
    render(<FileDropzone label="Attach a file" onFile={onFile} disabled />);
    const input = screen.getByLabelText("Attach a file");
    const zone = input.closest("label")!;

    expect(input).toBeDisabled();
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    expect(onFile).not.toHaveBeenCalled();
  });

  it("looks like a small outline button in the button variant, without the hint", () => {
    render(
      <FileDropzone variant="button" label="Attach file" hint="or drop it here" onFile={vi.fn()} />,
    );

    const zone = screen.getByLabelText("Attach file").closest("label")!;
    expect(zone).toHaveClass("border", "h-8");
    expect(screen.queryByText("or drop it here")).not.toBeInTheDocument();
    expect(zone.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
