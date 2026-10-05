import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ListToolbar } from "./list-toolbar";

/** Story 211 (PR-1.2) — the toolbar above a list or board. */
function renderToolbar(overrides: Partial<React.ComponentProps<typeof ListToolbar>> = {}) {
  const onCommit = vi.fn();
  const onClearAll = vi.fn();
  render(
    <ListToolbar
      search={{
        value: "",
        onCommit,
        label: "Search tickets",
        placeholder: "Search by subject or category...",
        clearLabel: "Clear search",
      }}
      filters={<select aria-label="Priority" />}
      filterCount={0}
      filtersLabel="Filters"
      closeLabel="Close"
      summary="128 tickets"
      onClearAll={onClearAll}
      clearAllLabel="Clear all"
      actions={<button type="button">New ticket</button>}
      {...overrides}
    />,
  );
  return { onCommit, onClearAll };
}

describe("ListToolbar", () => {
  it("commits search on Enter and on blur, not on every keystroke", () => {
    const { onCommit } = renderToolbar();
    const search = screen.getByRole("searchbox", { name: "Search tickets" });

    fireEvent.change(search, { target: { value: "invoice" } });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onCommit).toHaveBeenLastCalledWith("invoice");

    fireEvent.change(search, { target: { value: "refund" } });
    fireEvent.blur(search);
    expect(onCommit).toHaveBeenLastCalledWith("refund");
  });

  it("commits on every keystroke when the search is live (Story 223)", () => {
    const onCommit = vi.fn();
    renderToolbar({
      search: {
        value: "",
        onCommit,
        label: "Search articles",
        clearLabel: "Clear",
        commitOnChange: true,
      },
    });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search articles" }), {
      target: { value: "pass" },
    });
    expect(onCommit).toHaveBeenLastCalledWith("pass");
  });

  it("clears the search with its named button", () => {
    const { onCommit } = renderToolbar();
    const search = screen.getByPlaceholderText("Search by subject or category...");
    fireEvent.change(search, { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onCommit).toHaveBeenLastCalledWith("");
    expect(search).toHaveValue("");
  });

  it("announces the summary politely and keeps actions in the toolbar", () => {
    renderToolbar();
    expect(screen.getByRole("status")).toHaveTextContent("128 tickets");
    expect(screen.getByRole("button", { name: "New ticket" })).toBeInTheDocument();
  });

  it("offers clear-all only while something is filtered", () => {
    renderToolbar();
    expect(screen.queryByRole("button", { name: "Clear all" })).not.toBeInTheDocument();
  });

  it("collapses filters into a Filters (n) sheet holding the same controls", async () => {
    const user = userEvent.setup();
    const { onClearAll } = renderToolbar({ filterCount: 2 });

    await user.click(screen.getByRole("button", { name: "Filters (2)" }));
    const sheet = screen.getByRole("dialog", { name: "Filters" });
    expect(sheet).toContainElement(screen.getAllByRole("combobox", { name: "Priority" }).at(-1)!);

    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Clear all" }));
    expect(onClearAll).toHaveBeenCalledOnce();
  });
});
