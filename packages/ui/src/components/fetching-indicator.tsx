import * as React from "react";
import { cn } from "../lib/cn";
import { Spinner } from "./spinner";

export interface FetchingIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  /** A background fetch is in flight. Nothing renders when false. */
  active?: boolean;
  /**
   * Already-translated text, e.g. "Updating…". Announced politely, so a
   * screen-reader user learns the visible rows are being replaced rather
   * than silently changing under them.
   */
  label: string;
}

/**
 * Story S-7 — the "these rows are being refreshed" affordance.
 *
 * Before this story a filter or sort change produced a new query key, which
 * made `isLoading` true again and replaced the whole table with a skeleton.
 * Now the previous rows stay on screen (`placeholderData: keepPreviousData`),
 * which is a much better experience but leaves no signal that anything is
 * happening at all. This is that signal.
 *
 * Deliberately designed to sit in a caller's existing heading row rather
 * than above the content: a block-level indicator that appears and
 * disappears would push the table down and up on every keystroke-driven
 * refetch, and "no unexpected layout shift" is one of this story's own
 * acceptance criteria. Inside a heading row whose height is already set by
 * a `text-lg` title and an `h-8` button, a 12px spinner and `text-xs` label
 * add no height at all.
 *
 * `role="status"` (polite), never `role="alert"` — a refresh in progress is
 * not an interruption. Same distinction Story S-4 established for `Alert`.
 */
export function FetchingIndicator({
  active = false,
  label,
  className,
  ...props
}: FetchingIndicatorProps) {
  if (!active) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex items-center gap-1.5 text-xs text-ink-subtle", className)}
      {...props}
    >
      <Spinner className="h-3 w-3" />
      <span>{label}</span>
    </div>
  );
}
