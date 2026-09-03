import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { ConfirmDialog } from "./confirm-dialog";
import enMessages from "../../messages/en.json";

function renderDialog(overrides: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const onOpenChange = vi.fn();
  const onConfirm = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <button type="button">trigger</button>
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Deactivate this user?"
        description="They will no longer be able to sign in."
        confirmLabel="Deactivate"
        onConfirm={onConfirm}
        {...overrides}
      />
    </NextIntlClientProvider>,
  );
  return { onOpenChange, onConfirm };
}

describe("ConfirmDialog", () => {
  it("renders the title, description, and confirm label when open", () => {
    renderDialog();

    expect(screen.getByText("Deactivate this user?")).toBeInTheDocument();
    expect(screen.getByText("They will no longer be able to sign in.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deactivate" })).toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <ConfirmDialog
          open={false}
          onOpenChange={vi.fn()}
          title="Deactivate this user?"
          description="They will no longer be able to sign in."
          confirmLabel="Deactivate"
          onConfirm={vi.fn()}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.queryByText("Deactivate this user?")).not.toBeInTheDocument();
  });

  it("does NOT call onConfirm merely by being open — confirmation requires an explicit click", () => {
    const { onConfirm } = renderDialog();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("calls onOpenChange(false) and never onConfirm when Cancel is clicked", () => {
    const { onOpenChange, onConfirm } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("calls onConfirm exactly once when the confirm button is clicked", () => {
    const { onConfirm } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("disables both Cancel and Confirm, and shows a pending label, while isPending", () => {
    renderDialog({ isPending: true });

    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Working..." })).toBeDisabled();
  });

  it("ignores Escape while isPending (does not call onOpenChange)", () => {
    const { onOpenChange } = renderDialog({ isPending: true });

    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("closes on Escape when not pending", async () => {
    const { onOpenChange } = renderDialog();

    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("moves focus into the dialog on open", async () => {
    renderDialog();

    await waitFor(() => {
      expect(screen.getByRole("alertdialog")).toContainElement(
        document.activeElement as HTMLElement,
      );
    });
  });

  it("returns focus to the triggering element after close", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          <ConfirmDialog
            open={open}
            onOpenChange={setOpen}
            title="Deactivate this user?"
            description="They will no longer be able to sign in."
            confirmLabel="Deactivate"
            onConfirm={vi.fn()}
          />
        </NextIntlClientProvider>
      );
    }
    const user = userEvent.setup();
    render(<Harness />);

    // A real browser focuses a button on click (what Radix's FocusScope
    // records as "the element to restore focus to" on close) — `userEvent`
    // simulates that; plain `fireEvent.click` does not, which would make
    // this assertion meaningless.
    const trigger = screen.getByRole("button", { name: "Open" });
    await user.click(trigger);
    await screen.findByRole("alertdialog");

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(trigger).toHaveFocus(), { timeout: 3000 });
  });

  it("renders a non-destructive variant when destructive={false}", () => {
    renderDialog({ destructive: false, confirmLabel: "Save" });

    const confirmButton = screen.getByRole("button", { name: "Save" });
    expect(confirmButton.className).not.toContain("bg-danger-solid");
  });
});
