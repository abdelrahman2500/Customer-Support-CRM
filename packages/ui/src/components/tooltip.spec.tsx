import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

function renderTooltip() {
  return render(
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger>Export</TooltipTrigger>
        <TooltipContent>Download as CSV</TooltipContent>
      </Tooltip>
    </TooltipProvider>,
  );
}

describe("Tooltip", () => {
  it("is not rendered until the trigger is engaged", () => {
    renderTooltip();

    expect(screen.queryByText("Download as CSV")).not.toBeInTheDocument();
  });

  /** Opens on keyboard focus, not hover alone — the behaviour that makes a
   * tooltip reachable without a pointer. */
  it("opens on focus", async () => {
    const user = userEvent.setup();
    renderTooltip();

    await user.tab();
    expect(screen.getByRole("button", { name: "Export" })).toHaveFocus();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Download as CSV");
  });

  it("opens on hover", async () => {
    const user = userEvent.setup();
    renderTooltip();

    await user.hover(screen.getByRole("button", { name: "Export" }));
    expect(await screen.findByRole("tooltip")).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    renderTooltip();

    await user.tab();
    await screen.findByRole("tooltip");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
  });

  /** The tooltip describes the trigger; it must never be the trigger's only
   * accessible name, which is why the association is aria-describedby. */
  it("describes its trigger rather than naming it", async () => {
    const user = userEvent.setup();
    renderTooltip();

    await user.tab();
    await screen.findByRole("tooltip");
    const trigger = screen.getByRole("button", { name: "Export" });
    expect(trigger).toHaveAccessibleDescription("Download as CSV");
  });

  it("renders on the inverted surface, from tokens", async () => {
    const user = userEvent.setup();
    renderTooltip();

    await user.tab();
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveClass("bg-ink");
    expect(tooltip).toHaveClass("text-surface");
  });
});
