import * as React from "react";
import { cn } from "../lib/cn";

/**
 * Story S-4 — the shared "there is nothing here" block.
 *
 * This replaces a string the recon found hand-written 15 times across 13
 * files, always in exactly this shape:
 *
 *     <p className="rounded-md border border-dashed border-slate-300 p-8
 *                   text-center text-sm text-slate-500">{t("list.empty")}</p>
 *
 * The visual output is deliberately the same block, expressed in S-1 tokens
 * rather than raw palette values (`border-slate-300` is `--rule-strong` and
 * `text-slate-500` is `--ink-subtle`, so nothing shifts) with one small
 * improvement: when a description is supplied the title takes
 * `font-medium text-ink-strong`, so a two-line empty state reads as a
 * heading plus explanation instead of two equal grey lines. A title-only
 * empty state — which is what all 15 current call sites are — renders as the
 * single muted line it renders today.
 *
 * No `compact` variant. Every one of those 15 occurrences is `p-8` at the
 * same nesting level and none sits inside a card section, so a second size
 * would be an abstraction with no caller (CLAUDE.md §2). It is three lines
 * to add if a page migration turns one up.
 *
 * No illustration system either — an `icon` slot is accepted and rendered
 * when given, and nothing is supplied by default.
 */
export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Already-translated. This package owns no copy — see `index.ts`. */
  title: string;
  /** Already-translated optional second line explaining the emptiness. */
  description?: string;
  /**
   * Optional glyph above the title. Rendered inside an `aria-hidden`
   * wrapper: an empty state's meaning is carried entirely by its text, so
   * announcing the icon would only add noise.
   */
  icon?: React.ReactNode;
  /**
   * Optional next action — typically a shared `Button`. Two current call
   * sites have one (`article-list-view`'s "create article",
   * `dashboard-view`'s "browse all tickets"), which is why this is a
   * `ReactNode` slot rather than a label/handler pair: the caller keeps
   * control of variant, size and navigation.
   */
  action?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-md border border-dashed border-rule-strong p-8 text-center",
        className,
      )}
      {...props}
    >
      {icon ? (
        <span className="text-ink-subtle" aria-hidden="true">
          {icon}
        </span>
      ) : null}

      {/* A `<p>`, not a heading: this block is dropped into arbitrary places
          in a page's outline, and injecting an `<h3>` would silently break
          heading order on pages that already have their own hierarchy. The
          15 call sites being replaced are all `<p>` today. */}
      <p className={cn("text-sm", description ? "font-medium text-ink-strong" : "text-ink-subtle")}>
        {title}
      </p>

      {description ? <p className="text-sm text-ink-muted">{description}</p> : null}

      {action}
    </div>
  );
}
