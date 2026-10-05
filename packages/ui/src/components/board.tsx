import * as React from "react";
import { cn } from "../lib/cn";
import { recipes } from "../lib/recipes";

/**
 * Story 211 (PR-1.2) — the layout of a Kanban board, with no drag-and-drop
 * logic (that lives with the feature, PR-3.2).
 *
 * - `Board` is a labelled region whose columns sit side by side and scroll
 *   horizontally in their own box, snapping per column, so the page itself
 *   never scrolls sideways. Columns follow the document direction.
 * - `BoardColumn` is a quiet tray (the `column` recipe) with a status spine
 *   along its top edge, a header (dot, title, count) and a body that scrolls
 *   on its own. `collapsed` turns it into a narrow rail — icon, vertical
 *   title and count — that expands on click.
 */
export const Board = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="region"
      className={cn(
        "flex min-h-0 gap-stack overflow-x-auto overscroll-x-contain pb-2 [scroll-snap-type:x_mandatory] lg:[scroll-snap-type:none]",
        className,
      )}
      {...props}
    />
  ),
);
Board.displayName = "Board";

export interface BoardColumnProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title: React.ReactNode;
  /** The number of items the column holds (e.g. the query's total). */
  count?: number;
  /** Border/background utilities for the spine and dot, e.g. "border-info-solid" + "bg-info-solid". */
  spine: { border: string; dot: string };
  icon?: React.ReactNode;
  /** Header actions (a column menu). */
  actions?: React.ReactNode;
  /** Narrow rail; `onExpand` makes it a button. */
  collapsed?: boolean;
  onExpand?: () => void;
  expandLabel?: string;
  /** Under the body (e.g. "Show 17 more"). */
  footer?: React.ReactNode;
  /** Props for the scrolling body (a droppable ref, aria attributes). */
  bodyProps?: React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> };
}

export const BoardColumn = React.forwardRef<HTMLElement, BoardColumnProps>(
  (
    {
      title,
      count,
      spine,
      icon,
      actions,
      collapsed = false,
      onExpand,
      expandLabel,
      footer,
      bodyProps,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    if (collapsed) {
      return (
        <section
          ref={ref}
          className={cn(
            recipes.column,
            "flex w-14 shrink-0 snap-start flex-col items-center border-t-[3px] py-3",
            spine.border,
            className,
          )}
          {...props}
        >
          <button
            type="button"
            onClick={onExpand}
            aria-label={expandLabel}
            aria-expanded={false}
            className="focus-ring flex flex-1 flex-col items-center gap-stack rounded-inner px-1 py-2 text-ink-muted hover:bg-surface hover:text-ink"
          >
            {icon}
            <span className="text-sm font-semibold [writing-mode:vertical-rl]">{title}</span>
            {count !== undefined && (
              <span className="rounded-pill bg-surface px-1.5 text-caption tabular-nums text-ink-muted">
                {count}
              </span>
            )}
          </button>
        </section>
      );
    }

    const { className: bodyClassName, ...restBody } = bodyProps ?? {};
    return (
      <section
        ref={ref}
        className={cn(
          recipes.column,
          "flex min-h-0 w-[min(85vw,18rem)] shrink-0 snap-start flex-col border-t-[3px] sm:w-72 lg:w-auto lg:min-w-[17rem] lg:flex-1",
          spine.border,
          className,
        )}
        {...props}
      >
        <header className="flex items-center gap-tight px-3 pb-2 pt-3">
          <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-pill", spine.dot)} />
          {icon}
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{title}</h2>
          {count !== undefined && (
            <span className="rounded-pill bg-surface px-2 text-caption font-medium tabular-nums text-ink-muted ring-1 ring-rule">
              {count}
            </span>
          )}
          {actions}
        </header>
        <div
          {...restBody}
          className={cn(
            "flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2",
            bodyClassName,
          )}
        >
          {children}
        </div>
        {footer && <div className="px-2 pb-2">{footer}</div>}
      </section>
    );
  },
);
BoardColumn.displayName = "BoardColumn";
