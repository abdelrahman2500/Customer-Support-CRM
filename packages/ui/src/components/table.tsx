import * as React from "react";
import { cn } from "../lib/cn";

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
 * width. Sortable-column controls (`ticket-list-view.tsx`'s/
 * `customer-list-view.tsx`'s own `<button>` + `SortIndicator` inside a
 * `TableHead`) are a deliberate, disclosed desktop-only affordance below
 * `sm` as a result — no mobile equivalent sort control exists yet; no
 * story has disclosed a need for one, and inventing one is out of scope
 * here.
 */
export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  /** The column header text this cell belongs to — rendered as a small,
   * always-visible label to the left of the value below `sm` (where the
   * real `<th>` is hidden), and hidden itself at `sm` and up (where the
   * real header row already says this). Omit only for a cell that needs
   * no mobile label of its own (e.g. a purely visual/decorative cell). */
  label?: string;
}

export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("block w-full text-start text-sm sm:table", className)} {...props} />
    </div>
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

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "flex flex-col gap-2 rounded-md border border-rule p-3 sm:table-row sm:flex-row sm:gap-0 sm:rounded-none sm:border-0 sm:p-0 sm:hover:bg-surface-sunk",
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "hidden h-10 px-3 text-start align-middle text-xs font-medium uppercase tracking-wide text-ink-subtle sm:table-cell",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, label, children, ...props }: TableCellProps) {
  return (
    <td
      className={cn(
        "flex items-center justify-between gap-3 px-3 py-2 align-middle sm:table-cell sm:justify-normal",
        className,
      )}
      {...props}
    >
      {label && (
        <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-ink-subtle sm:hidden">
          {label}
        </span>
      )}
      {children}
    </td>
  );
}
