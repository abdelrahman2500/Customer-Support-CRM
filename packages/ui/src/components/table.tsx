import * as React from "react";
import { cn } from "../lib/cn";
import { SortIndicator } from "./sort-indicator";
import type { SortDirection } from "./sort-indicator";

/**
 * RM-10 — Mobile-Responsive Data Tables. Below `sm` (640px, Tailwind's own
 * default breakpoint — this preset defines no custom `screens`), every row
 * renders as a stacked card (a bordered block, one label/value pair per
 * line) instead of a `<tr>`; at `sm` and up, the exact same markup renders
 * as a real table, unchanged from before this story. This is a pure-CSS
 * dual-layout, not two separate render trees or a `matchMedia`/JS
 * viewport check (no such precedent existed anywhere in this codebase —
 * every other responsive pattern here is mobile-first Tailwind
 * breakpoints on one shared markup tree, e.g. `dashboard-view.tsx`'s own
 * `sm:flex-row` list-item pattern) — the caller writes the same JSX
 * either way, and CSS alone decides which shape renders.
 *
 * `<table>`/`<thead>`/`<tbody>`/`<tr>`/`<th>` all lose their implicit
 * table-related ARIA roles once their `display` is overridden away from
 * `table`/`table-row`/etc. below `sm` — this is expected, not a defect:
 * `TableHead` is hidden entirely below `sm` (a raw table-navigation
 * announcement per cell would be more confusing than a flat list once the
 * tabular relationship is gone), and `TableCell`'s own `label` prop
 * supplies the same information as real, always-visible text instead —
 * every value stays identifiable to every user, sighted or not, at every
 * width. Sortable-column controls (`TableSortHead`) live in the hidden
 * header, so they are a deliberate, disclosed desktop-only affordance below
 * `sm`; the mobile sort control is RD-4.1.
 *
 * Story 188 (RD-1.11) — Table v2: a `density` shared through context
 * (`compact`, the default, is exactly the pre-188 padding; `comfortable` is
 * the design language's ~48px row), a hover tint (`surface-muted`) that is
 * visible on the page canvas (the old `surface-sunk` IS the canvas colour),
 * a `selected` row state, `text-label` headers and mobile labels with no
 * `uppercase`/`tracking-wide` (meaningless in Arabic, and letter-spacing
 * breaks its joined script), token mobile cards, and `TableSortHead`.
 */
export type TableDensity = "compact" | "comfortable";

const TableDensityContext = React.createContext<TableDensity>("compact");

/** Story 188 — `compact` is the pre-188 padding exactly; `comfortable` is roadmap §2.10's ~48px row. */
const HEAD_DENSITY: Record<TableDensity, string> = {
  compact: "h-10 px-3",
  comfortable: "h-11 px-4",
};
const CELL_DENSITY: Record<TableDensity, string> = {
  compact: "px-3 py-2",
  comfortable: "px-4 py-3",
};

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  /** The column header text this cell belongs to — rendered as a small,
   * always-visible label to the left of the value below `sm` (where the
   * real `<th>` is hidden), and hidden itself at `sm` and up (where the
   * real header row already says this). Omit only for a cell that needs
   * no mobile label of its own (e.g. a purely visual/decorative cell). */
  label?: string;
}

export interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  /** Story 188 — row/cell padding for the whole table. Defaults to `compact`. */
  density?: TableDensity;
}

export function Table({ className, density = "compact", ...props }: TableProps) {
  return (
    <TableDensityContext.Provider value={density}>
      <div className="w-full overflow-x-auto">
        <table
          data-density={density}
          className={cn("block w-full text-start text-sm sm:table", className)}
          {...props}
        />
      </div>
    </TableDensityContext.Provider>
  );
}

export function TableHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn("hidden border-b border-rule sm:table-header-group", className)}
      {...props}
    />
  );
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={cn(
        "flex flex-col gap-3 sm:table-row-group sm:gap-0 sm:divide-y sm:divide-rule-subtle",
        className,
      )}
      {...props}
    />
  );
}

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  /**
   * Story 188 — visual selected state (`data-selected` + the accent tint).
   * Deliberately NOT `aria-selected`: that is only defined for rows inside
   * `role="grid"`/`"treegrid"`. A caller in a grid passes `aria-selected`
   * itself, and it is forwarded like any other prop.
   */
  selected?: boolean;
}

export function TableRow({ className, selected, ...props }: TableRowProps) {
  return (
    <tr
      data-selected={selected ? "true" : undefined}
      className={cn(
        "flex flex-col gap-2 rounded-surface border border-rule bg-surface p-3 transition-colors duration-fast data-[selected=true]:bg-accent-surface sm:table-row sm:flex-row sm:gap-0 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:hover:bg-surface-muted sm:data-[selected=true]:bg-accent-surface",
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  const density = React.useContext(TableDensityContext);
  return (
    <th
      className={cn(
        "hidden text-start align-middle text-label text-ink-subtle sm:table-cell",
        HEAD_DENSITY[density],
        className,
      )}
      {...props}
    />
  );
}

export interface TableSortHeadProps
  extends Omit<React.ThHTMLAttributes<HTMLTableCellElement>, "onClick" | "aria-sort"> {
  /** The column's current direction, or null/undefined when another column is sorted. */
  direction: SortDirection | null | undefined;
  /** Called when the header button is activated; the caller owns the toggle logic. */
  onSort: () => void;
  children: React.ReactNode;
}

/**
 * Story 188 (RD-1.11) — a sortable column header: `aria-sort` on the
 * `<th>` (the semantic counterpart to `SortIndicator`'s visual arrow, A11Y-2)
 * and a real `<button>` that hands the toggle back to the caller. Replaces
 * the identical hand-rolled headers the ticket and customer lists carried.
 */
export function TableSortHead({ direction, onSort, children, ...props }: TableSortHeadProps) {
  const ariaSort = direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none";
  return (
    <TableHead aria-sort={ariaSort} {...props}>
      <button type="button" className="focus-ring rounded-inner hover:underline" onClick={onSort}>
        {children}
        <SortIndicator direction={direction ?? null} />
      </button>
    </TableHead>
  );
}

export function TableCell({ className, label, children, ...props }: TableCellProps) {
  const density = React.useContext(TableDensityContext);
  return (
    <td
      className={cn(
        "flex items-center justify-between gap-3 align-middle sm:table-cell sm:justify-normal",
        CELL_DENSITY[density],
        className,
      )}
      {...props}
    >
      {label && <span className="shrink-0 text-label text-ink-subtle sm:hidden">{label}</span>}
      {children}
    </td>
  );
}
