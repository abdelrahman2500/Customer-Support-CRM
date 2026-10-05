import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet";

/** Story 211 (PR-1.2) — the side panel. */
function renderSheet(side?: "start" | "end") {
  return render(
    <Sheet>
      <SheetTrigger>Edit user</SheetTrigger>
      <SheetContent closeLabel="Close" side={side}>
        <SheetHeader>
          <SheetTitle>Edit user</SheetTitle>
          <SheetDescription>Roles and access</SheetDescription>
        </SheetHeader>
        <SheetBody>
          <input aria-label="Full name" />
        </SheetBody>
        <SheetFooter>
          <button type="button">Save</button>
        </SheetFooter>
      </SheetContent>
    </Sheet>,
  );
}

describe("Sheet", () => {
  it("opens as a named, described dialog and returns focus to its trigger on Escape", async () => {
    const user = userEvent.setup();
    renderSheet();
    const trigger = screen.getByRole("button", { name: "Edit user" });

    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Edit user" });
    expect(dialog).toHaveAccessibleDescription("Roles and access");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("enters from the inline end by default, mirrored in RTL, and from the start for drawers", async () => {
    const user = userEvent.setup();
    const { unmount } = renderSheet();
    await user.click(screen.getByRole("button", { name: "Edit user" }));
    let dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-side", "end");
    expect(dialog.className).toContain("end-0");
    expect(dialog.className).toContain("[--sheet-from:100%]");
    expect(dialog.className).toContain("rtl:[--sheet-from:-100%]");
    unmount();

    renderSheet("start");
    await user.click(screen.getByRole("button", { name: "Edit user" }));
    dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("start-0");
    expect(dialog.className).toContain("[--sheet-from:-100%]");
  });

  it("names its close button with the caller's label", async () => {
    const user = userEvent.setup();
    renderSheet();
    await user.click(screen.getByRole("button", { name: "Edit user" }));
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
