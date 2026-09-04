import * as React from "react";
import { cn } from "../lib/cn";

/**
 * Story S-3 — the multi-line counterpart to `Input`, matching it token for
 * token so the two read as one family: same `rounded-md`, same
 * `border-rule-strong`, same `bg-surface`, same `text-sm`, same
 * `placeholder:text-ink-subtle`, same shared `.focus-ring`.
 *
 * Replaces the inline
 * `w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm`
 * string that appears in five places across the two apps (the ticket note
 * composer, both chat composers, the article body editor, the notification
 * template body). Those call sites are deliberately not migrated here — this
 * story establishes primitives; S-11 owns the form surfaces.
 *
 * `py-2` rather than `Input`'s `py-1`: a textarea has no fixed height, so its
 * padding sets the first line's rhythm, and 2 matches what all five inline
 * copies already used.
 *
 * `field-sizing-content` is deliberately *not* set. Auto-growing is a real
 * improvement but it is a behaviour change to every composer that adopts
 * this, and this story is a like-for-like extraction.
 */
export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, rows = 3, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        "focus-ring flex w-full rounded-md border border-rule-strong bg-surface px-3 py-2 text-sm text-ink shadow-sm transition-colors placeholder:text-ink-subtle disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
