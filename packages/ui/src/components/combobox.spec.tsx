import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Combobox, type ComboboxOption } from "./combobox";

/** Story 204 (RD-3.4, recon TW-08) — the searchable single-select. */
const OPTIONS: ComboboxOption[] = [
  {
    value: "u1",
    label: "Ada Lovelace",
    description: "Online",
    leading: <span aria-hidden="true">A</span>,
  },
  { value: "u2", label: "Grace Hopper", description: "Offline" },
  { value: "u3", label: "Alan Turing", description: "Online" },
];

function renderCombobox(props: Partial<React.ComponentProps<typeof Combobox>> = {}) {
  const onValueChange = vi.fn();
  render(
    <Combobox
      options={OPTIONS}
      value={undefined}
      onValueChange={onValueChange}
      aria-label="Assigned agent"
      placeholder="Unassigned"
      searchLabel="Search agents"
      emptyText="No matches"
      {...props}
    />,
  );
  return { onValueChange, trigger: screen.getByRole("combobox", { name: "Assigned agent" }) };
}

describe("Combobox", () => {
  it("renders a combobox trigger with listbox popup semantics and the placeholder", () => {
    const { trigger } = renderCombobox();

    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger).toHaveAttribute("aria-haspopup", "listbox");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveTextContent("Unassigned");
  });

  it("shows the selected option's label (and leading content) on the trigger", () => {
    const { trigger } = renderCombobox({ value: "u1" });
    expect(trigger).toHaveTextContent("AAda Lovelace");
  });

  it("opens on click into a search input controlling a listbox of options", async () => {
    const user = userEvent.setup();
    const { trigger } = renderCombobox({ value: "u2" });

    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const search = screen.getByRole("combobox", { name: "Search agents" });
    const listbox = screen.getByRole("listbox", { name: "Assigned agent" });
    expect(search).toHaveFocus();
    expect(search).toHaveAttribute("aria-autocomplete", "list");
    expect(search).toHaveAttribute("aria-controls", listbox.id);
    expect(trigger).toHaveAttribute("aria-controls", listbox.id);
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(3);
    // The option's description is part of its accessible name (presence as text).
    expect(screen.getByRole("option", { name: /Grace Hopper\s*Offline/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    // The selected option starts active.
    expect(search).toHaveAttribute("aria-activedescendant", options[1]!.id);
  });

  it("opens from the keyboard with ArrowDown", async () => {
    const user = userEvent.setup();
    const { trigger } = renderCombobox();

    trigger.focus();
    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("moves the active option with arrows, Home and End, and selects with Enter", async () => {
    const user = userEvent.setup();
    const { trigger, onValueChange } = renderCombobox();

    await user.click(trigger);
    const search = screen.getByRole("combobox", { name: "Search agents" });
    const ids = screen.getAllByRole("option").map((o) => o.id);

    expect(search).toHaveAttribute("aria-activedescendant", ids[0]);
    await user.keyboard("{ArrowDown}");
    expect(search).toHaveAttribute("aria-activedescendant", ids[1]);
    await user.keyboard("{End}");
    expect(search).toHaveAttribute("aria-activedescendant", ids[2]);
    await user.keyboard("{ArrowDown}");
    expect(search).toHaveAttribute("aria-activedescendant", ids[2]);
    await user.keyboard("{Home}");
    expect(search).toHaveAttribute("aria-activedescendant", ids[0]);
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onValueChange).toHaveBeenCalledWith("u2");
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
  });

  it("filters by typing (label or description) and shows the empty text", async () => {
    const user = userEvent.setup();
    const { trigger, onValueChange } = renderCombobox();

    await user.click(trigger);
    await user.keyboard("tur");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Alan TuringOnline"]);
    await user.keyboard("{Enter}");
    expect(onValueChange).toHaveBeenCalledWith("u3");

    await user.click(trigger);
    await user.keyboard("zzz");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("No matches")).toBeInTheDocument();
  });

  it("selects with a click, and does not report the value it already has", async () => {
    const user = userEvent.setup();
    const { trigger, onValueChange } = renderCombobox({ value: "u1" });

    await user.click(trigger);
    await user.click(screen.getByRole("option", { name: /Ada Lovelace/ }));
    expect(onValueChange).not.toHaveBeenCalled();

    await user.click(trigger);
    await user.click(screen.getByRole("option", { name: /Alan Turing/ }));
    expect(onValueChange).toHaveBeenCalledWith("u3");
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    const { trigger } = renderCombobox();

    await user.click(trigger);
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("can be disabled", () => {
    const { trigger } = renderCombobox({ disabled: true });
    expect(trigger).toBeDisabled();
  });

  it("uses no physical-direction utility", async () => {
    const user = userEvent.setup();
    const { trigger } = renderCombobox({ value: "u1" });
    await user.click(trigger);

    const html = trigger.outerHTML + screen.getByRole("listbox").parentElement!.outerHTML;
    expect(html).not.toMatch(/\b(ml|mr|pl|pr|text-left|text-right)-/);
  });
});
