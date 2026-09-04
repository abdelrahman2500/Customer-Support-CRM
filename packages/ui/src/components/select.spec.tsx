import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

/** Long enough to exceed any viewport — the assignee/category filters are
 * sourced from live queries and can run to hundreds of rows. */
const MANY = Array.from({ length: 60 }, (_, i) => `Agent ${i + 1}`);

function renderSelect(options: string[] = MANY, onValueChange = vi.fn()) {
  render(
    <Select onValueChange={onValueChange}>
      <SelectTrigger aria-label="Assigned agent">
        <SelectValue placeholder="Any" />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>,
  );
  return { onValueChange };
}

describe("Select", () => {
  it("opens on click and exposes listbox/option semantics", async () => {
    const user = userEvent.setup();
    renderSelect(["Low", "High"]);

    await user.click(screen.getByRole("combobox", { name: "Assigned agent" }));
    expect(await screen.findByRole("listbox")).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("selects an option and reports it to the caller", async () => {
    const user = userEvent.setup();
    const { onValueChange } = renderSelect(["Low", "High"]);

    await user.click(screen.getByRole("combobox", { name: "Assigned agent" }));
    await user.click(await screen.findByRole("option", { name: "High" }));
    expect(onValueChange).toHaveBeenCalledWith("High");
  });

  it("is keyboard operable", async () => {
    const user = userEvent.setup();
    renderSelect(["Low", "High"]);

    await user.tab();
    expect(screen.getByRole("combobox", { name: "Assigned agent" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("listbox")).toBeInTheDocument();
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    renderSelect(["Low", "High"]);

    const trigger = screen.getByRole("combobox", { name: "Assigned agent" });
    await user.click(trigger);
    await screen.findByRole("listbox");
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  describe("containment (recon D2)", () => {
    /** The fix: the panel is bounded to the space Radix measured between the
     * trigger and the viewport edge, so a 60-option list cannot grow past
     * the fold or extend the page. */
    /**
     * The fix: the panel is bounded to the space Radix measured between the
     * trigger and the viewport edge, so a 60-option list can neither grow
     * past the fold nor extend the page.
     *
     * Radix puts role=listbox on the Content element, with the scrolling
     * Viewport as its child — so the ceiling and the scroll container are
     * asserted on those two respectively.
     */
    it("bounds the panel height to the space Radix measured", async () => {
      const user = userEvent.setup();
      renderSelect();

      await user.click(screen.getByRole("combobox", { name: "Assigned agent" }));
      const content = await screen.findByRole("listbox");
      expect(content.className).toContain("max-h-[var(--radix-select-content-available-height)]");
    });

    it("scrolls the overflow inside the panel rather than the page", async () => {
      const user = userEvent.setup();
      renderSelect();

      await user.click(screen.getByRole("combobox", { name: "Assigned agent" }));
      const content = await screen.findByRole("listbox");
      expect(content).toHaveClass("overflow-y-auto");

      // The inner viewport inherits the ceiling rather than setting its own,
      // so the two can never disagree.
      const viewport = content.querySelector("[data-radix-select-viewport]");
      expect(viewport).not.toBeNull();
      expect(viewport).toHaveClass("max-h-[inherit]");
      expect(viewport).toHaveClass("overflow-y-auto");
    });

    it("renders all options for a long list without truncating the data", async () => {
      const user = userEvent.setup();
      renderSelect();

      await user.click(screen.getByRole("combobox", { name: "Assigned agent" }));
      await screen.findByRole("listbox");
      expect(screen.getAllByRole("option")).toHaveLength(60);
    });

    /** Portalled, so the panel is not clipped by a table's own
     * overflow-x-auto wrapper. */
    it("renders outside a clipping ancestor", async () => {
      const user = userEvent.setup();
      const { container } = render(
        <div style={{ overflow: "hidden" }}>
          <Select>
            <SelectTrigger aria-label="Status">
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="OPEN">OPEN</SelectItem>
            </SelectContent>
          </Select>
        </div>,
      );

      await user.click(screen.getByRole("combobox", { name: "Status" }));
      const listbox = await screen.findByRole("listbox");
      expect(container.contains(listbox)).toBe(false);
    });
  });

  it("keeps the trigger's own token styling and shared focus treatment", () => {
    renderSelect(["Low"]);

    const trigger = screen.getByRole("combobox", { name: "Assigned agent" });
    expect(trigger).toHaveClass("border-rule-strong");
    expect(trigger).toHaveClass("bg-surface");
    expect(trigger).toHaveClass("focus-ring-always");
    expect(trigger.className).not.toMatch(/slate-\d/);
  });
});
