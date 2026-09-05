import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pagination } from "./pagination";

function setup(overrides: Partial<React.ComponentProps<typeof Pagination>> = {}) {
  const onPageChange = vi.fn();
  const utils = render(
    <Pagination
      page={2}
      totalPages={5}
      onPageChange={onPageChange}
      label="Audit log pages"
      previousLabel="Previous page"
      nextLabel="Next page"
      indicator="Page 2 of 5"
      {...overrides}
    />,
  );
  return { onPageChange, ...utils };
}

describe("Pagination", () => {
  it("renders nothing for a single-page result", () => {
    const { container } = setup({ page: 1, totalPages: 1 });

    // A permanently-disabled pager beside a three-row table is noise.
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when there are no pages at all", () => {
    const { container } = setup({ page: 1, totalPages: 0 });

    expect(container).toBeEmptyDOMElement();
  });

  it("labels the landmark and both controls", () => {
    setup();

    expect(screen.getByRole("navigation", { name: "Audit log pages" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next page" })).toBeInTheDocument();
  });

  it("announces the current page politely", () => {
    setup();

    const indicator = screen.getByText("Page 2 of 5");
    expect(indicator).toHaveAttribute("aria-live", "polite");
  });

  it("moves forward and back by one page", async () => {
    const { onPageChange } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(onPageChange).toHaveBeenCalledWith(3);

    await userEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("disables previous on the first page", async () => {
    const { onPageChange } = setup({ page: 1 });

    const previous = screen.getByRole("button", { name: "Previous page" });
    expect(previous).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeEnabled();

    await userEvent.click(previous);
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("disables next on the last page", async () => {
    const { onPageChange } = setup({ page: 5 });

    const next = screen.getByRole("button", { name: "Next page" });
    expect(next).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeEnabled();

    await userEvent.click(next);
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("blocks both controls while a page change is still resolving", async () => {
    // Guards against a rapid double-click queueing a second jump.
    const { onPageChange } = setup({ disabled: true });

    const next = screen.getByRole("button", { name: "Next page" });
    const previous = screen.getByRole("button", { name: "Previous page" });
    expect(next).toBeDisabled();
    expect(previous).toBeDisabled();

    await userEvent.click(next);
    await userEvent.click(previous);
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("is operable from the keyboard", async () => {
    const { onPageChange } = setup();

    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Previous page" })).toHaveFocus();

    await userEvent.tab();
    const next = screen.getByRole("button", { name: "Next page" });
    expect(next).toHaveFocus();

    await userEvent.keyboard("{Enter}");
    expect(onPageChange).toHaveBeenCalledWith(3);

    await userEvent.keyboard(" ");
    expect(onPageChange).toHaveBeenCalledTimes(2);
  });

  it("skips a disabled control in the tab order", async () => {
    setup({ page: 1 });

    await userEvent.tab();
    // Previous is disabled on page 1, so focus lands on next.
    expect(screen.getByRole("button", { name: "Next page" })).toHaveFocus();
  });

  it("carries the shared focus ring on both controls", () => {
    setup();

    for (const name of ["Previous page", "Next page"]) {
      expect(screen.getByRole("button", { name })).toHaveClass("focus-ring");
    }
  });

  it("orders the controls logically so direction mirrors under RTL", () => {
    setup();

    const buttons = screen.getAllByRole("button");
    // Previous precedes next in the DOM; a flex row reverses that itself
    // under `dir="rtl"`, so no physical positioning is needed.
    expect(buttons[0]).toHaveAccessibleName("Previous page");
    expect(buttons[1]).toHaveAccessibleName("Next page");
  });

  it("flips each chevron with the reading direction rather than pointing it physically", () => {
    const { container } = setup();

    const chevrons = container.querySelectorAll("svg");
    expect(chevrons).toHaveLength(2);
    for (const chevron of chevrons) {
      // A bare left chevron would point at the wrong page in Arabic.
      expect(chevron.getAttribute("class")).toContain("rtl:rotate-180");
      expect(chevron).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("uses no physical direction classes", () => {
    const { container } = setup();

    // `ms-`/`me-` and flex order carry layout; `left`/`right` would pin it.
    const markup = container.innerHTML;
    expect(markup).not.toMatch(/\bml-\d|\bmr-\d|\bleft-\d|\bright-\d/);
  });

  it("takes already-translated labels, holding no copy of its own", () => {
    setup({
      label: "صفحات سجل التدقيق",
      previousLabel: "الصفحة السابقة",
      nextLabel: "الصفحة التالية",
      indicator: "صفحة ٢ من ٥",
    });

    expect(screen.getByRole("navigation", { name: "صفحات سجل التدقيق" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "الصفحة السابقة" })).toBeInTheDocument();
    expect(screen.getByText("صفحة ٢ من ٥")).toBeInTheDocument();
  });

  it("merges a caller className and spreads other props", () => {
    setup({ className: "mt-4", "data-testid": "pager" } as never);

    const nav = screen.getByTestId("pager");
    expect(nav).toHaveClass("mt-4");
    expect(nav).toHaveClass("flex");
  });
});
