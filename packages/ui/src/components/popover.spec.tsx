import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "./popover";
import { Input } from "./input";
import { Label } from "./label";

function renderPopover() {
  return render(
    <div style={{ overflow: "hidden" }}>
      <Popover>
        <PopoverTrigger>Filters</PopoverTrigger>
        <PopoverContent>
          <Label htmlFor="q">Search</Label>
          <Input id="q" />
          <PopoverClose>Done</PopoverClose>
        </PopoverContent>
      </Popover>
    </div>,
  );
}

describe("Popover", () => {
  it("is closed until the trigger is activated, and reports expansion", async () => {
    const user = userEvent.setup();
    renderPopover();

    const trigger = screen.getByRole("button", { name: "Filters" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(trigger);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("moves focus into the panel so its controls are reachable", async () => {
    const user = userEvent.setup();
    renderPopover();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    const panel = await screen.findByRole("dialog");
    await waitFor(() => expect(panel).toContainElement(document.activeElement as HTMLElement));
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    renderPopover();

    const trigger = screen.getByRole("button", { name: "Filters" });
    await user.click(trigger);
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("closes via PopoverClose", async () => {
    const user = userEvent.setup();
    renderPopover();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  /** Portalled out of an `overflow: hidden` ancestor — the clipping problem
   * the recon logged for floating surfaces. */
  it("renders outside a clipping ancestor", async () => {
    const user = userEvent.setup();
    const { container } = renderPopover();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    const panel = await screen.findByRole("dialog");
    expect(container.contains(panel)).toBe(false);
  });

  /** Non-modal by design: unlike Dialog it must not trap focus or block the
   * page, so a user can keep working with the panel open. */
  it("is not a modal dialog", async () => {
    const user = userEvent.setup();
    renderPopover();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    const panel = await screen.findByRole("dialog");
    expect(panel).not.toHaveAttribute("aria-modal", "true");
  });

  it("bounds its height against the available popper space", async () => {
    const user = userEvent.setup();
    renderPopover();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    const panel = await screen.findByRole("dialog");
    expect(panel.className).toContain("max-h-[var(--radix-popper-available-height)]");
    expect(panel).toHaveClass("overflow-y-auto");
  });
});
