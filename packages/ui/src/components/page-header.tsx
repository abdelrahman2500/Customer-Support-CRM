import * as React from "react";
import { cn } from "../lib/cn";

/**
 * Story 140 — one page identity for the whole product.
 *
 * Before this, every screen declared its own title inline and two scales had
 * drifted apart: `text-lg font-semibold text-ink` (28 files in `apps/web`, 6
 * in `apps/portal`) and `text-xl` (4 and 4). Some screens followed the title
 * with a description, some wrapped title + action in their own
 * `flex items-center justify-between` row, and most had no room for an action
 * at all — so "the primary thing you do on this page" had no consistent home.
 *
 * `text-lg` was kept as the canonical size by that story: it is what the
 * large majority already used, so standardising on it was a consistency fix
 * rather than a re-scaling of 28 screens. Revisiting the type scale itself
 * was left as "a separate, deliberate decision".
 *
 * Story 170 is that decision. The title now renders at `text-title` — the
 * 1.5rem step Story 134 named for exactly this and never spent. The recon
 * that commissioned that scale found page titles at `text-lg` and section
 * titles at body size, only one small step apart, "which is why pages read
 * flat"; this is the half of the fix that lives here, `CardTitle`'s
 * `text-subhead` is the other. `font-semibold` is gone because the `title`
 * step declares `fontWeight: 600` in its own `fontSize` tuple — stating the
 * weight twice is how the two drift apart later.
 *
 * ## Layout
 *
 * Title block and actions sit on one row from `sm` up and stack below it, so
 * a page with two buttons does not crush its own title on a phone. The title
 * block carries `min-w-0` because a page title can be a customer or article
 * name — free text that would otherwise refuse to shrink and push the action
 * off-screen (the same failure `ArticleListView`'s own row documents having
 * measured at 390px).
 *
 * Direction-neutral by construction: `justify-between` plus logical stacking,
 * no `ml-*`/`mr-*`/`text-left`. Both apps hold zero physical-direction
 * utilities and this keeps it that way.
 *
 * Renders a real `<header>` landmark, and the `<h1>` is the page's single
 * level-1 heading — several screens previously had none at all, or hid one
 * with `sr-only` because their visible title was an input.
 *
 * ## Slots (Story 197, RD-2.3)
 *
 * `back` (a `BackLink`) sits above the title row, `meta` (badges, ids,
 * timestamps) wraps under the title and description, and `tabs` spans the
 * full width below. None may contain a heading above `h2` — the title stays
 * the page's only `h1`. Without `back` and `tabs` the rendered tree is
 * exactly the pre-slot one, so existing pages are unchanged.
 */
export interface PageHeaderProps {
  /** The page's own name. Rendered as the single `<h1>`. */
  title: React.ReactNode;
  /** One short line under the title. Omit rather than pass an empty string. */
  description?: React.ReactNode;
  /**
   * Primary (and, where it genuinely helps, secondary) actions for the page.
   * Pass the buttons themselves; spacing and wrapping are handled here.
   */
  actions?: React.ReactNode;
  /** Story 197 — a way back (typically `BackLink`), above the title row. */
  back?: React.ReactNode;
  /** Story 197 — a wrapping row of page facts under the title/description. */
  meta?: React.ReactNode;
  /** Story 197 — section tabs, full width below the title row. */
  tabs?: React.ReactNode;
  /**
   * Story 198 (RD-2.4, recon A11Y-04) — `2` only for a view hosted under
   * another page's `h1` (Settings' tabs). It renders an `h2` at the
   * heading step, in a plain `<div>` rather than a `<header>` landmark,
   * because it is a section of the host page, not a page of its own.
   */
  headingLevel?: 1 | 2;
  className?: string;
}

const ROW = "flex flex-col gap-inline sm:flex-row sm:items-start sm:justify-between";

export function PageHeader({
  title,
  description,
  actions,
  back,
  meta,
  tabs,
  headingLevel = 1,
  className,
}: PageHeaderProps) {
  const Root = headingLevel === 1 ? "header" : "div";
  const row = (
    <>
      <div className="min-w-0">
        {headingLevel === 1 ? (
          <h1 className="text-title text-ink">
            {/* Story 233 — a title is often user text (a ticket subject, an
                article or customer name): isolated, so its punctuation
                stays put in the other direction. */}
            <bdi>{title}</bdi>
          </h1>
        ) : (
          <h2 className="text-heading text-ink">
            <bdi>{title}</bdi>
          </h2>
        )}
        {description && <p className="mt-1 text-sm text-ink-subtle">{description}</p>}
        {meta && (
          <div className="mt-2 flex flex-wrap items-center gap-inline text-sm text-ink-muted">
            {meta}
          </div>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-inline">{actions}</div>}
    </>
  );

  if (!back && !tabs) {
    return <Root className={cn(ROW, className)}>{row}</Root>;
  }
  return (
    <Root className={cn("flex flex-col gap-stack", className)}>
      {back && <div className="flex">{back}</div>}
      <div className={ROW}>{row}</div>
      {tabs && <div className="min-w-0">{tabs}</div>}
    </Root>
  );
}
