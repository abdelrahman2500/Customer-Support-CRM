import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";

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
      "rounded-md",
      "border",
      "sm:table-row",
      "sm:border-0",
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
