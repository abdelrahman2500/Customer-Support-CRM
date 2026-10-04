import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableSortHead,
} from "./table";

/**
 * RM-10 — Mobile-Responsive Data Tables. jsdom applies no real stylesheet
 * (Tailwind's own generated CSS is never loaded in this test environment),
 * so `getComputedStyle`/CSS `display` cannot be asserted here — these
 * tests instead assert the two things that matter regardless of which
 * layout is actually rendered on screen: (1) the exact utility classes
 * that drive the responsive behavior are present on the right elements
 * (a direct, if indirect, proxy for "the CSS rule exists"), and (2) the
 * `label` prop's own real, always-in-the-DOM text renders — the part of
 * this feature that both layouts, and every consumer, actually depend on.
 */
describe("Table", () => {
  it("renders a real table structure regardless of viewport (role=table/row/columnheader/cell all present)", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell label="Name">Jane Doe</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeInTheDocument();
    expect(screen.getByRole("cell")).toBeInTheDocument();
  });

  it("wraps the table in a horizontal-scroll container", () => {
    const { container } = render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>x</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    const wrapper = container.firstElementChild;
    expect(wrapper).toHaveClass("overflow-x-auto");
  });

  it("marks the table block-level below sm and a real table at sm and up", () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>x</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByRole("table")).toHaveClass("block", "sm:table");
  });

  it("hides the header row below sm, restoring it as a real header group at sm and up", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>x</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByRole("columnheader").closest("thead")).toHaveClass(
      "hidden",
      "sm:table-header-group",
    );
  });

  it("hides each individual column header below sm, restoring it as a real table cell at sm and up", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody />
      </Table>,
    );

    expect(screen.getByRole("columnheader")).toHaveClass("hidden", "sm:table-cell");
  });

  it("stacks rows as bordered cards below sm, reverting to plain table rows at sm and up", () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>x</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByRole("cell").closest("tr")).toHaveClass(
      "flex",
      "flex-col",
      // Story 188 — the mobile card takes the token radius and surface.
      "rounded-surface",
      "bg-surface",
      "border",
      "sm:table-row",
      "sm:border-0",
      "sm:bg-transparent",
    );
  });

  it("renders the label prop as real, always-visible text, hidden only at sm and up", () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell label="Status">Active</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByText("Status")).toHaveClass("sm:hidden");
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("renders no label element at all when the label prop is omitted", () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Active</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByRole("cell")).toHaveTextContent("Active");
    expect(screen.queryByText("Status")).not.toBeInTheDocument();
  });

  it("still forwards arbitrary props (e.g. a caller-owned aria-sort) straight onto the real <th>", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead aria-sort="ascending">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody />
      </Table>,
    );

    expect(screen.getByRole("columnheader", { name: "Created" })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
  });

  it("still forwards arbitrary props (e.g. onClick) straight onto the real <tr>", () => {
    render(
      <Table>
        <TableBody>
          <TableRow data-testid="clickable-row">
            <TableCell>x</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByTestId("clickable-row")).toBeInTheDocument();
  });

  it("merges a caller-supplied className alongside the built-in responsive classes, never replacing them", () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell className="text-end">x</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByRole("cell")).toHaveClass("text-end", "sm:table-cell");
  });
});

describe("Table v2 (Story 188)", () => {
  function renderTable(props: { density?: "compact" | "comfortable"; selected?: boolean } = {}) {
    return render(
      <Table density={props.density}>
        <TableHeader>
          <TableRow>
            <TableHead>Subject</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow selected={props.selected} aria-selected={props.selected ? true : undefined}>
            <TableCell label="Subject">Printer down</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
  }

  it("defaults to compact density, exactly the pre-188 padding", () => {
    renderTable();
    expect(screen.getByRole("columnheader")).toHaveClass("h-10", "px-3");
    expect(screen.getByRole("cell")).toHaveClass("px-3", "py-2");
    expect(screen.getByRole("table")).toHaveAttribute("data-density", "compact");
  });

  it("offers a comfortable density for the whole table", () => {
    renderTable({ density: "comfortable" });
    expect(screen.getByRole("columnheader")).toHaveClass("h-11", "px-4");
    expect(screen.getByRole("cell")).toHaveClass("px-4", "py-3");
    expect(screen.getByRole("table")).toHaveAttribute("data-density", "comfortable");
  });

  it("sets header and mobile labels on the label type step, never uppercase or tracked", () => {
    renderTable();
    const head = screen.getByRole("columnheader");
    const mobileLabel = screen.getAllByText("Subject").find((el) => el.tagName === "SPAN")!;
    for (const el of [head, mobileLabel]) {
      expect(el).toHaveClass("text-label");
      expect(el).not.toHaveClass("uppercase");
      expect(el).not.toHaveClass("tracking-wide");
    }
  });

  it("tints a hovered row with surface-muted and a selected row with accent-surface", () => {
    renderTable({ selected: true });
    const row = screen.getByRole("cell").closest("tr")!;
    expect(row).toHaveClass("sm:hover:bg-surface-muted", "data-[selected=true]:bg-accent-surface");
    expect(row).toHaveAttribute("data-selected", "true");
    // aria-selected is the caller's to set (only meaningful in a grid) and is forwarded.
    expect(row).toHaveAttribute("aria-selected", "true");
  });

  it("leaves an unselected row without the selected marker", () => {
    renderTable();
    expect(screen.getByRole("cell").closest("tr")).not.toHaveAttribute("data-selected");
  });
});

describe("TableSortHead (Story 188)", () => {
  function renderSortHead(direction: "asc" | "desc" | null, onSort = vi.fn()) {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableSortHead direction={direction} onSort={onSort}>
              Created
            </TableSortHead>
          </TableRow>
        </TableHeader>
      </Table>,
    );
    return onSort;
  }

  it.each([
    ["asc", "ascending"],
    ["desc", "descending"],
  ] as const)("maps %s to aria-sort=%s and shows the indicator", (direction, aria) => {
    renderSortHead(direction);
    const header = screen.getByRole("columnheader", { name: "Created" });
    expect(header).toHaveAttribute("aria-sort", aria);
    expect(header.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("reports aria-sort=none and hides the indicator when another column is sorted", () => {
    renderSortHead(null);
    const header = screen.getByRole("columnheader", { name: "Created" });
    expect(header).toHaveAttribute("aria-sort", "none");
    expect(header.querySelector("svg")).toBeNull();
  });

  it("hands activation back to the caller through a real button", async () => {
    const onSort = renderSortHead("asc");
    await userEvent.click(screen.getByRole("button", { name: "Created" }));
    expect(onSort).toHaveBeenCalledTimes(1);
  });
});
