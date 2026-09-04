import * as React from "react";
import { cn } from "../lib/cn";
import { SortAscIcon, SortDescIcon, SortIcon } from "../lib/icons";

export type SortDirection = "asc" | "desc";

// `direction` is also an SVG presentation attribute, so it has to be
// omitted before being redeclared - the same collision `EmptyStateProps`
// has with `title`.
export interface SortIndicatorProps extends Omit<React.SVGAttributes<SVGSVGElement>, "direction"> {
  /** The column's current direction, or `null`/`undefined` when it is not
   * the sorted column. */
  direction?: SortDirection | null;
  /**
   * Render a neutral up/down glyph on unsorted columns, signalling that the
   * header is sortable at all. Off by default so existing headers keep
   * rendering nothing until they are sorted, exactly as they do today.
   */
  showInactive?: boolean;
}

/**
 * Story S-5 — the sortable-column arrow.
 *
 * Three table headers (`ticket-list-view`'s createdAt and updatedAt,
 * `customer-list-view`'s two) each carried the same nested ternary
 * appending a literal `" ▲"`/`" ▼"` to the label. Those are geometric-shape
 * characters: they inherit no icon sizing, sit off the text baseline, and
 * get announced by some screen readers as "black up-pointing triangle".
 *
 * Domain-agnostic by design — it takes a direction, not a column name, a
 * field or a sort state object, so it knows nothing about what is being
 * sorted.
 *
 * `aria-hidden` always: the arrow duplicates information that belongs on
 * the header element as `aria-sort`, which is the caller's to set because
 * only the caller owns the `<th>`. Announcing the glyph as well would say
 * the same thing twice, and inconsistently.
 */
export function SortIndicator({
  direction,
  showInactive = false,
  className,
  ...props
}: SortIndicatorProps) {
  if (!direction && !showInactive) {
    return null;
  }

  const Icon = direction === "asc" ? SortAscIcon : direction === "desc" ? SortDescIcon : SortIcon;

  return (
    <Icon
      aria-hidden="true"
      // `ms-1` rather than `ml-1`: the arrow follows the label along the
      // reading direction, so it lands to the label's left under RTL.
      className={cn("ms-1 inline h-3.5 w-3.5 align-[-0.125em]", className)}
      {...props}
    />
  );
}
