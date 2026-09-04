import * as React from "react";
import { cn } from "../lib/cn";
import { Alert } from "./alert";
import { Button } from "./button";
import { EmptyState } from "./empty-state";
import type { EmptyStateProps } from "./empty-state";
import { SkeletonText } from "./skeleton";

/**
 * Story S-4 — the one place a query's loading / error / empty / content
 * branches are expressed.
 *
 * Every list screen in both apps currently rebuilds the same four-branch
 * ladder by hand (83 files branch on `isLoading`/`isPending`, 32 render
 * their own destructive `Alert` with a retry button, 15 hand-write the
 * dashed empty block). `ticket-list-view` is the canonical copy:
 *
 *     {q.isLoading && <ListSkeleton />}
 *     {q.isError && <Alert variant="destructive">... <Button>retry</Button></Alert>}
 *     {q.isSuccess && q.data.length === 0 && <p className="...border-dashed...">}
 *     {q.isSuccess && q.data.length > 0 && <Table>...</Table>}
 *
 * Two things that ladder gets wrong every time it is written out, and that
 * this component fixes once: the loading state is invisible to a screen
 * reader (no live region, and the skeleton group is often not hidden), and
 * the empty branch cannot tell "you have no tickets" from "your filters
 * matched nothing" without the caller duplicating the block.
 *
 * ## Composition, not a fixed layout
 *
 * Each state is configured through its own object prop, and each accepts a
 * `ReactNode` escape hatch, so a screen with a genuinely different shape
 * (the dashboard's tiles, a detail page) overrides that one branch instead
 * of abandoning the component. On success it renders `children` **with no
 * wrapper at all** — there is no element in the tree to fight a table's or
 * a grid's own layout.
 *
 * ## Branch order
 *
 * `loading` -> `error` -> `empty` -> `children`. A first load wins over a
 * stale error, and an error wins over rendering an empty list that is
 * actually just unknown. Nothing here retries on its own: `onRetry` fires
 * only from the button, which is the shared `Button` and therefore keyboard
 * operable with the S-1 focus ring for free.
 *
 * Domain-free by construction — it knows about a query's *shape*, never
 * about tickets, customers, articles or reports.
 */
export interface QueryStateErrorProps {
  /** Already-translated error text. */
  title: string;
  /** Already-translated optional detail line. */
  description?: string;
  /** Already-translated retry label. Required to render the retry button. */
  retryLabel?: string;
  /** Retry handler — typically `() => query.refetch()`. */
  onRetry?: () => void;
  /** Puts the retry button in its S-3 loading state during a refetch. */
  isRetrying?: boolean;
}

export interface QueryStateCardProps {
  /** First load in flight — `query.isLoading`. */
  isLoading?: boolean;
  /** The query failed — `query.isError`. */
  isError?: boolean;
  /** Loaded successfully with nothing to show — `data.length === 0`. */
  isEmpty?: boolean;
  /**
   * A search term or filter is currently narrowing the query, so an empty
   * result means "nothing matched", not "nothing exists". When true,
   * `noResults` is preferred over `empty`.
   *
   * `article-list-view` already makes exactly this distinction by hand, keyed
   * on `search !== ""` — two near-identical dashed blocks, one with a create
   * CTA and one without. Passing both copies here replaces that duplication.
   */
  isFiltered?: boolean;

  /** Already-translated text announced politely while loading. */
  loadingLabel: string;
  /**
   * Placeholder for the loading branch. Defaults to five table-row-height
   * bars, which is `ListSkeleton`'s exact shape — pass a `SkeletonCard`
   * stack, a detail skeleton or anything else for a screen that is not a
   * list. Matching the loaded content's rough height here is what keeps the
   * page from jumping when data arrives.
   */
  loadingPlaceholder?: React.ReactNode;

  /** Error branch configuration, or a fully custom node. */
  error?: QueryStateErrorProps | React.ReactNode;
  /** Empty-dataset branch. Reuses `EmptyState`'s own props verbatim. */
  empty?: EmptyStateProps | React.ReactNode;
  /** Filtered/no-match branch. Falls back to `empty` when not supplied. */
  noResults?: EmptyStateProps | React.ReactNode;

  /** The loaded content. Rendered unwrapped. */
  children?: React.ReactNode;
  /** Applied to the loading/error/empty wrapper only — never to `children`. */
  className?: string;
}

/** `{ title: ... }` is a config object; anything else is a node to render. */
function isConfig<T extends { title: string }>(value: unknown): value is T {
  return typeof value === "object" && value !== null && !React.isValidElement(value);
}

export function QueryStateCard({
  isLoading = false,
  isError = false,
  isEmpty = false,
  isFiltered = false,
  loadingLabel,
  loadingPlaceholder,
  error,
  empty,
  noResults,
  children,
  className,
}: QueryStateCardProps) {
  if (isLoading) {
    return (
      // Labelled `role="status"` with the placeholder hidden beneath it: the
      // announcement is "Loading tickets", once, instead of a screen reader
      // walking a stack of empty boxes.
      <div role="status" aria-busy="true" aria-label={loadingLabel} className={className}>
        {loadingPlaceholder ?? <SkeletonText lines={5} barClassName="h-10" />}
      </div>
    );
  }

  if (isError) {
    if (error !== undefined && !isConfig<QueryStateErrorProps>(error)) {
      return <>{error}</>;
    }

    const config = (error ?? { title: "" }) as QueryStateErrorProps;
    const canRetry = Boolean(config.onRetry && config.retryLabel);

    return (
      // `variant="destructive"` keeps `role="alert"` (see `alert.tsx`), so a
      // failure that appears after the page has settled is announced.
      <Alert
        variant="destructive"
        className={cn("flex flex-wrap items-center justify-between gap-2", className)}
      >
        <span className="flex flex-col gap-0.5">
          <span>{config.title}</span>
          {config.description ? (
            <span className="text-xs opacity-80">{config.description}</span>
          ) : null}
        </span>

        {canRetry ? (
          <Button
            variant="outline"
            size="sm"
            onClick={config.onRetry}
            isLoading={config.isRetrying}
          >
            {config.retryLabel}
          </Button>
        ) : null}
      </Alert>
    );
  }

  if (isEmpty) {
    const chosen = (isFiltered ? (noResults ?? empty) : empty) ?? null;

    if (chosen === null) {
      return null;
    }
    if (!isConfig<EmptyStateProps>(chosen)) {
      return <>{chosen}</>;
    }
    return <EmptyState {...chosen} className={cn(chosen.className, className)} />;
  }

  // Success: no wrapper, no extra element, nothing between the caller and
  // its own markup.
  return <>{children}</>;
}
