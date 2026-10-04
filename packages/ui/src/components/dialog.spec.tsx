import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

function renderDialog(props: { showClose?: boolean } = {}) {
  return render(
    <Dialog>
      <DialogTrigger>Open</DialogTrigger>
      <DialogContent closeLabel="Close" {...props}>
        <DialogHeader>
          <DialogTitle>Assign ticket</DialogTitle>
          <DialogDescription>Pick an agent to take this over.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose>Cancel</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>,
  );
}

describe("Dialog", () => {
  it("is closed until the trigger is activated", async () => {
    const user = userEvent.setup();
    renderDialog();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  /** The semantic difference from ConfirmDialog, which is deliberately an
   * alertdialog because it interrupts and demands a decision. */
  it("is a dialog, not an alertdialog", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("is named and described by its title and description", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Open" }));
    const dialog = await screen.findByRole("dialog", { name: "Assign ticket" });
    expect(dialog).toHaveAccessibleDescription("Pick an agent to take this over.");
  });

  it("moves focus into the dialog on open", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Open" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Open" }));
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("returns focus to the trigger after closing", async () => {
    const user = userEvent.setup();
    renderDialog();

    const trigger = screen.getByRole("button", { name: "Open" });
    await user.click(trigger);
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");

    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("closes via the labelled corner close button", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Open" }));
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("omits the corner close button when showClose is false", async () => {
    const user = userEvent.setup();
    renderDialog({ showClose: false });

    await user.click(screen.getByRole("button", { name: "Open" }));
    await screen.findByRole("dialog");
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });

  /** Portalled to body, so an ancestor with overflow:hidden cannot clip it. */
  it("renders its content outside the triggering subtree", async () => {
    const user = userEvent.setup();
    const { container } = renderDialog();

    await user.click(screen.getByRole("button", { name: "Open" }));
    const dialog = await screen.findByRole("dialog");
    expect(container.contains(dialog)).toBe(false);
  });

  // Batch 8 (UX audit) — below `max-w-md`, a bare `w-full` panel touches
  // both screen edges on a very narrow viewport (~320px) with nothing but
  // its own inner padding for a gutter.
  it("keeps a gutter from the viewport edge instead of a bare full width", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Open" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.className).toContain("w-[calc(100%-2rem)]");
  });

  it("does not render the close button without a label to name it", async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>No close label</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    await user.click(screen.getByRole("button", { name: "Open" }));
    await screen.findByRole("dialog");
    // An unnamed icon-only button would be unusable, so it is omitted.
    expect(screen.queryByRole("button", { name: "" })).not.toBeInTheDocument();
  });
});

describe("ConfirmDialog is unaffected by Dialog sharing its overlay classes", () => {
  it("still renders as an alertdialog", async () => {
    const { ConfirmDialog } = await import("./confirm-dialog");
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Deactivate?"
        description="They cannot sign in."
        confirmLabel="Deactivate"
        cancelLabel="Cancel"
        workingLabel="Working..."
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});

describe("Dialog design-language surface (Story 187)", () => {
  function renderSized(size?: "sm" | "md" | "lg" | "xl") {
    return render(
      <Dialog defaultOpen>
        <DialogContent closeLabel="Close" size={size}>
          <DialogTitle>Assign ticket</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
  }

  it("defaults to today's width (md) on the raised overlay surface", async () => {
    renderSized();
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveClass("max-w-md", "bg-surface-raised", "rounded-surface", "shadow-overlay");
  });

  it.each([
    ["sm", "max-w-sm"],
    ["lg", "max-w-lg"],
    ["xl", "max-w-2xl"],
  ] as const)("applies the %s width instead of the default", async (size, width) => {
    renderSized(size);
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveClass(width);
    expect(dialog).not.toHaveClass("max-w-md");
  });

  it("puts the title on the named type scale", async () => {
    renderSized();
    expect(await screen.findByText("Assign ticket")).toHaveClass("text-heading");
  });

  it("keeps the close button named, on the inner radius, with a decorative icon", async () => {
    renderSized();
    const close = await screen.findByRole("button", { name: "Close" });
    expect(close).toHaveClass("rounded-inner", "end-4");
    expect(close.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
