import * as React from "react";
import { cn } from "../lib/cn";
import { ChevronLeftIcon, ChevronRightIcon } from "../lib/icons";
import { Button } from "./button";

export interface PaginationProps extends Omit<React.HTMLAttributes<HTMLElement>, "children"> {
  /** Current 1-based page. */
  page: number;
  /** Total pages, as reported by the API's `totalPages`. */
  totalPages: number;
  /** Called with the requested page. Never called for a page outside
   * `1..totalPages`, so a caller does not have to clamp. */
  onPageChange: (page: number) => void;
  /** Already-translated accessible name for the surrounding landmark. */
  label: string;
  /** Already-translated accessible name for the previous-page control. */
  previousLabel: string;
  /** Already-translated accessible name for the next-page control. */
  nextLabel: string;
  /**
   * Already-translated, already-interpolated page indicator, e.g.
   * "Page 2 of 7". Composed by the caller because pluralisation and word
   * order belong to the message catalogue, not to this package.
   */
  indicator: string;
  /**
   * Blocks both controls without changing which one is at a boundary. Used
   * while a page change is still resolving, so a rapid double-click cannot
   * queue a second jump on top of the first.
   */
  disabled?: boolean;
}

/**
 * Story S-8a — the shared pager, introduced with the first paginated
 * endpoint.
 *
 * Renders nothing when there is only one page. A single-page result needs
 * no controls, and a permanently-disabled pager next to a three-row table
 * is noise that also costs vertical space on every unfiltered screen.
 *
 * Both controls are real `<button>`s from the shared `Button`, so keyboard
 * activation, `disabled` semantics and the S-1 focus ring all come for
 * free rather than being re-implemented. Anything using `onClick` on a
 * `<div>` here would lose all three.
 *
 * ## Direction
 *
 * "Previous" and "next" are logical, not physical. Two things make that
 * work: the controls sit in DOM order previous-then-next inside a flex
 * row, which the browser already reverses under `dir="rtl"`; and each
 * chevron carries `rtl:rotate-180`, so the glyph points the way it means
 * rather than the way it was drawn. `../lib/icons` documents this as the
 * required treatment for exactly this case — a bare `ChevronLeftIcon`
 * would point at the wrong page in Arabic.
 */
export function Pagination({
  page,
  totalPages,
  onPageChange,
  label,
  previousLabel,
  nextLabel,
  indicator,
  disabled = false,
  className,
  ...props
}: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const atFirst = page <= 1;
  const atLast = page >= totalPages;

  return (
    <nav
      aria-label={label}
      className={cn("flex items-center justify-end gap-3", className)}
      {...props}
    >
      {/* `aria-live="polite"`: a keyboard user who activates "next" gets
          told which page they landed on, rather than having to hunt for
          the change. */}
      <span aria-live="polite" className="text-xs text-ink-muted">
        {indicator}
      </span>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={previousLabel}
          disabled={disabled || atFirst}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeftIcon className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={nextLabel}
          disabled={disabled || atLast}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRightIcon className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
