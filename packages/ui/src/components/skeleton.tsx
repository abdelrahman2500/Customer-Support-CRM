import * as React from "react";
import { cn } from "../lib/cn";
import { Card, CardContent } from "./card";

/**
 * The base placeholder block. Unchanged since S-2 — every existing caller
 * (35 files) keeps working exactly as before, including the ones that pass
 * their own height/width and the ones that override the tint.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-rule", className)} {...props} />;
}

/**
 * Story S-4 — a stack of equal placeholder bars.
 *
 * This is the single most duplicated loading shape in the repository: 19
 * files map over a literal array of `Skeleton`s to draw pending rows. The
 * three concrete variations are all just a bar count and a bar height —
 * `ticket-list-view`'s `ListSkeleton` is 5 x `h-10`, `reports-view`'s list
 * variant is 3 x `h-5`, `customer-detail-view`'s sections are 2 x `h-8` —
 * so those are the two knobs, and nothing else.
 *
 * `aria-hidden` by default, which is the accessibility fix hiding in this
 * consolidation: three of the four existing local skeleton helpers set it on
 * their wrapper and `ListSkeleton` forgets to, so a screen reader currently
 * walks five empty `div`s while a ticket list loads. Announcing *that*
 * something is loading is `QueryStateCard`'s job, once, in a labelled live
 * region — not each individual bar's.
 */
export interface SkeletonTextProps extends React.HTMLAttributes<HTMLDivElement> {
  /** How many bars to draw. */
  lines?: number;
  /** Per-bar classes — height above all (`h-10` for table rows, `h-5` for
   * text). Defaults to a text-sized bar. */
  barClassName?: string;
}

export function SkeletonText({ lines = 3, barClassName, className, ...props }: SkeletonTextProps) {
  return (
    <div aria-hidden="true" className={cn("flex flex-col gap-2", className)} {...props}>
      {Array.from({ length: Math.max(0, lines) }).map((_, index) => (
        <Skeleton key={index} className={cn("h-4 w-full", barClassName)} />
      ))}
    </div>
  );
}

/**
 * Story S-4 — a bordered panel with a short heading bar and a body.
 *
 * The other shape that actually repeats: a `h-4 w-32` heading bar over one
 * or more body bars inside `rounded-md border border-slate-200 bg-white p-4`
 * — six times in `ticket-detail-view`, three in `customer-detail-view`, once
 * in the portal's ticket detail. Built from the shared `Card`, so the panel
 * chrome comes from one place and cannot drift from a real card's.
 *
 * Deliberately *not* added: `SkeletonAvatar` (one `rounded-full` skeleton
 * exists in the whole repository) and `SkeletonRow` (no skeleton is rendered
 * inside a `TableCell` anywhere). Both would be variants with no caller.
 */
export interface SkeletonCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Body bars below the heading. */
  lines?: number;
  /** Per-body-bar classes, as `SkeletonText`. */
  barClassName?: string;
}

export function SkeletonCard({ lines = 2, barClassName, className, ...props }: SkeletonCardProps) {
  return (
    <Card aria-hidden="true" className={className} {...props}>
      <CardContent>
        <Skeleton className="h-4 w-32" />
        <SkeletonText
          lines={lines}
          barClassName={cn("h-8", barClassName)}
          className="mt-2"
          // The card already hides the whole subtree; repeating it on the
          // inner group would be redundant.
          aria-hidden={undefined}
        />
      </CardContent>
    </Card>
  );
}

/**
 * Global Navigation Loading — the generic route-transition fallback for
 * every route segment that has no page-specific skeleton of its own.
 *
 * `TicketDetailSkeleton`/`CustomerDetailSkeleton`/`ArticleDetailSkeleton`
 * (Story 97) already solved this exact "frozen page, no feedback during the
 * RSC-payload/bundle fetch for the new segment" gap for the three detail
 * routes, by shaping a `loading.tsx` after the page's own layout. Extending
 * that same per-page-shaped treatment to every other route (list pages,
 * settings/admin screens, the dashboard — ~30 segments across both apps)
 * would mean hand-shaping and maintaining that many bespoke skeletons for a
 * transition that, unlike a page's own `query.isLoading` render, is only
 * ever on screen for the duration of a route change. This is the one
 * generic shape those segments share instead: a heading bar (every one of
 * them renders a page title first) over two card-shaped content blocks
 * (the two most common shapes below it — a table or a form). It is not
 * meant to preview any specific page's real layout, only to replace
 * "nothing changed yet" with "something is happening" the instant a
 * navigation starts, exactly as `loading.tsx` already does natively via
 * Suspense for the three routes that have one.
 *
 * `aria-hidden` on every bar (inherited from `Skeleton`/`SkeletonCard`), no
 * live region: mirrors Story 97's own three skeletons exactly, none of
 * which announce themselves either — App Router's own focus management
 * moves focus into the new page once it mounts, and that page's real
 * content (or its own `query.isLoading` skeleton) takes over the
 * accessible story from there.
 */
export function RouteLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      <Skeleton className="h-7 w-48" />
      <SkeletonCard lines={4} />
      <SkeletonCard lines={4} />
    </div>
  );
}
