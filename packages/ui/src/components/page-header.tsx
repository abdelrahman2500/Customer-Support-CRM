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
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-inline sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-title text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-subtle">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-inline">{actions}</div>}
    </header>
  );
}
