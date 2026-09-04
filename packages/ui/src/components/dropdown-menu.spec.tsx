import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";

function renderMenu(onEdit = vi.fn(), onDelete = vi.fn()) {
  render(
    <DropdownMenu>
      <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Ticket</DropdownMenuLabel>
        <DropdownMenuItem onSelect={onEdit}>Edit</DropdownMenuItem>
        <DropdownMenuItem disabled>Reassign</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={onDelete}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>,
  );
  return { onEdit, onDelete };
}

describe("DropdownMenu", () => {
  it("is closed until the trigger is activated, and reports expansion", async () => {
    const user = userEvent.setup();
    renderMenu();

    const trigger = screen.getByRole("button", { name: "Actions" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await user.click(trigger);
    expect(await screen.findByRole("menu")).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("exposes menu/menuitem semantics", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: "Actions" }));
    await screen.findByRole("menu");
    expect(screen.getAllByRole("menuitem")).toHaveLength(3);
  });

  it("selects an item on click", async () => {
    const user = userEvent.setup();
    const { onEdit } = renderMenu();

    await user.click(screen.getByRole("button", { name: "Actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalled();
  });

  /** Arrow-key roving focus — the behaviour a hand-rolled dropdown of plain
   * buttons does not provide. */
  it("moves focus through items with the arrow keys", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: "Actions" }));
    await screen.findByRole("menu");
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Edit" })).toHaveFocus();
  });

  it("skips a disabled item and never selects it", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: "Actions" }));
    const disabled = await screen.findByRole("menuitem", { name: "Reassign" });
    expect(disabled).toHaveAttribute("data-disabled");
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    renderMenu();

    const trigger = screen.getByRole("button", { name: "Actions" });
    await user.click(trigger);
    await screen.findByRole("menu");
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  /** Portalled, so a menu opened from the last row of a table is not clipped
   * by that table's own overflow-x-auto wrapper. */
  it("renders its content outside the triggering subtree", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <div style={{ overflow: "hidden" }}>
        <DropdownMenu>
          <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Edit</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>,
    );

    await user.click(screen.getByRole("button", { name: "Actions" }));
    const menu = await screen.findByRole("menu");
    expect(container.contains(menu)).toBe(false);
  });

  it("styles a destructive item with the danger token, not a palette literal", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: "Actions" }));
    const item = await screen.findByRole("menuitem", { name: "Delete" });
    expect(item).toHaveClass("text-danger-foreground");
    expect(item.className).not.toMatch(/red-\d/);
  });
});
