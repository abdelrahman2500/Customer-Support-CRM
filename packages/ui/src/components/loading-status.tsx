import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../lib/cn";

/**
 * Story 161 — the accessible semantics of a loading state, separated from any
 * particular placeholder shape.
 *
 * `QueryStateCard` (Story S-4) already gets this right, and its own spec pins
 * both halves of the contract: a labelled `role="status"` element, and an
 * `aria-hidden` placeholder inside it. But that behaviour was only available
 * to screens willing to adopt `QueryStateCard`'s whole visual composition —
 * its `SkeletonText` loading shape and its dashed `EmptyState`. Twenty-four
 * hand-rolled loading branches across eighteen files therefore kept their own
 * bespoke placeholders and, with them, both defects:
 *
 * - no live region at all, so a screen reader is told nothing while a panel
 *   loads; and
 * - a bare `Skeleton`, which — unlike `SkeletonText`/`SkeletonCard` — is not
 *   `aria-hidden`, so the placeholder boxes are left in the accessibility
 *   tree with nothing to say.
 *
 * This is the accessibility, on its own, for screens whose placeholder is
 * deliberately not `SkeletonText`: a compact bar sized to a chat panel, three
 * rows sized to a table, a single line sized to an SLA target. Those shapes
 * are domain judgements about what the page is about to show, and replacing
 * them all with one generic shape would be a redesign this does not need.
 *
 * ## Structure
 *
 * ```
 * <div role="status" aria-busy="true" aria-label={label}>   // announced once
 *   <div aria-hidden="true" class={className}>              // the placeholder
 * ```
 *
 * The announcement lives on the outer element and the placeholder on the
 * inner one because `aria-hidden` cannot sit on the live region itself
 * without hiding the very thing being announced — the same reason
 * `QueryStateCard` nests them.
 *
 * `className` lands on the **placeholder**, not the status wrapper, so a
 * caller's existing `flex flex-col gap-2` keeps applying to the element that
 * directly contains its bars. The status wrapper is an unstyled block, which
 * is why inserting it changes no layout: at every call site the loading
 * branch is already a single child of either a block container or a
 * `flex-col` one, and it stays a single child of both.
 *
 * `asChild` follows `Card`'s and `Button`'s existing use of the same Radix
 * mechanism: where the placeholder is already one element — usually a lone
 * `Skeleton` — it becomes the `aria-hidden` placeholder itself rather than
 * gaining a wrapper it does not need.
 *
 * Announced once, not repeatedly: this mounts when a first load begins and
 * unmounts when it ends, so `role="status"`'s implicit polite live region
 * fires on appearance. It is deliberately not rendered during a background
 * refetch, which keeps previously loaded content on screen (Story S-7) and
 * has nothing new to announce.
 */
export interface LoadingStatusProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Already-translated text announced politely while loading. */
  label: string;
  /**
   * Render the placeholder semantics onto the caller's own element instead of
   * a wrapping `div` — for a placeholder that is already a single element.
   */
  asChild?: boolean;
  /**
   * Story 162 — set `false` for a placeholder that is not wholly decorative,
   * leaving it in the accessibility tree with its own finer-grained hiding in
   * charge.
   *
   * The portal's notification history is the case that asked for this: its
   * placeholder is a real `Table` carrying the same column headers the
   * populated table will use, and it already marks only its `TableBody`
   * `aria-hidden` so those headers stay announced. Hiding the whole subtree
   * would take away content that screen deliberately kept.
   *
   * Rare by design. A placeholder made of bare `Skeleton` bars has nothing to
   * say and should keep the default.
   */
  placeholderHidden?: boolean;
}

export function LoadingStatus({
  label,
  asChild = false,
  placeholderHidden = true,
  className,
  children,
  ...props
}: LoadingStatusProps) {
  const Placeholder = asChild ? Slot : "div";

  return (
    <div role="status" aria-busy="true" aria-label={label}>
      <Placeholder
        aria-hidden={placeholderHidden ? "true" : undefined}
        className={cn(className)}
        {...props}
      >
        {children}
      </Placeholder>
    </div>
  );
}
