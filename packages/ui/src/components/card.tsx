import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

/**
 * Story S-3 — a composable card, to replace the
 * `rounded-md border border-slate-200 bg-white p-4` string that the recon
 * counted hand-written in 44 files.
 *
 * Padding lives on the *sections*, not on `Card` itself. That is what makes a
 * footer able to sit flush against a full-width divider, and a media block
 * able to bleed to the card's edge, without every call site fighting the
 * container's own padding. The trade-off is that `Card` alone has no padding
 * — so the exact shape those 44 files use today is
 * `<Card><CardContent>…</CardContent></Card>`, which resolves to the same
 * border, radius, surface and `p-4` they already have.
 *
 * `elevation` exists because the recon's §11 found the opposite problem to
 * inconsistency: *uniformity*. Border, radius and shadow were spent equally
 * on every block, so a KPI tile, a data table and a form section all read as
 * equally important. `flat` is the default and reproduces today's look
 * exactly; `raised` is available for the one thing on a page that should draw
 * the eye. Nothing is migrated to `raised` in this story.
 */
const cardVariants = cva("rounded-surface border border-rule bg-surface", {
  variants: {
    elevation: {
      flat: "",
      raised: "shadow-resting",
    },
  },
  defaultVariants: { elevation: "flat" },
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {
  /**
   * Story 139 — render the card's styling onto the caller's own element
   * instead of a `div`, mirroring `Button`'s existing `asChild` exactly
   * (same `@radix-ui/react-slot` mechanism).
   *
   * A surface is not always a `div`: the portal home's panels are
   * `<section>` landmarks, and the branding screen's surface IS the
   * `<form>` that submits it. Forcing those through a `div` would drop a
   * landmark and break a submit handler respectively, so those call sites
   * pass `asChild` and keep their own element.
   */
  asChild?: boolean;
}

export function Card({ className, elevation, asChild = false, ...props }: CardProps) {
  const Comp = asChild ? Slot : "div";
  return <Comp className={cn(cardVariants({ elevation }), className)} {...props} />;
}

/**
 * Title row. `justify-between` so a trailing action (an export button, a
 * menu) sits opposite the title without the caller re-creating a flex row —
 * the shape `ReportCard` already uses for exactly that.
 */
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-start justify-between gap-inline p-surface pb-0", className)}
      {...props}
    />
  );
}

/** The heading levels a card title can legitimately be. Deliberately not
 * `keyof JSX.IntrinsicElements`: a card title is a heading, and letting a
 * caller pass `div` or `span` would let the document outline be dropped by
 * accident — the exact failure this prop exists to prevent. */
export type CardTitleLevel = "h2" | "h3" | "h4";

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /**
   * Heading level. Defaults to `h3`, which is what this component has always
   * rendered — existing callers are unaffected.
   *
   * Story 154 — added because the default was wrong for the dominant case and
   * that made the whole component unusable. 49 section headings across both
   * apps are hand-written `<h2 className="text-sm font-semibold text-ink">`,
   * carrying the same three classes this component owns. Every one of them
   * needs `h2`: they sit under a page-level `PageHeader` `h1`, so an `h3`
   * would skip a level. Story 139 measured that and correctly declined to
   * adopt `CardTitle` rather than break the outline — which left the
   * component with zero consumers.
   */
  as?: CardTitleLevel;
}

/**
 * `text-subhead` — 1rem/600, the step Story 134 named for a section heading.
 *
 * Story 154 shipped this as `text-sm font-semibold`, the size and weight the
 * 49 hand-written section headings already used, because standardising on
 * what existed was that story's job. Story 170 changed it: body size for a
 * section heading is half of the "pages read flat" finding the type scale
 * was defined to fix (`PageHeader`'s `text-title` is the other half), and a
 * heading that measures the same as the paragraph under it is not a
 * hierarchy. `font-semibold` is gone because `subhead` declares
 * `fontWeight: 600` in its own `fontSize` tuple.
 *
 * Why `as` and not this package's usual `asChild`: `asChild` delegates the
 * whole element, so a caller would write
 * `<CardTitle asChild><h2>Notes</h2></CardTitle>` — longer than the raw
 * `<h2 className="text-sm font-semibold text-ink">` it is meant to replace,
 * which would leave adoption exactly where Story 139 found it. `as` picks a
 * level; it does not hand over the element, so the two conventions do not
 * overlap. `Card`, `Button` and `Select` keep `asChild` for what it is for.
 */
export function CardTitle({ className, as: Heading = "h3", ...props }: CardTitleProps) {
  return <Heading className={cn("text-subhead text-ink", className)} {...props} />;
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-1 text-sm text-ink-muted", className)} {...props} />;
}

/** The body. Named `CardContent` rather than `CardBody` to match the
 * shadcn/ui vocabulary the rest of this package already follows. */
export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-surface", className)} {...props} />;
}

/** Divided from the body, because a footer holds actions and needs to read as
 * separate from the content it acts on. */
export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-inline border-t border-rule-subtle px-surface py-stack",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Story 154 — a card that is a titled section of a page.
 *
 * This shape was written out by hand **49 times** across both apps:
 *
 *     <Card className="p-surface">
 *       <h2 className="text-sm font-semibold text-ink">{title}</h2>
 *       …body…
 *     </Card>
 *
 * It renders exactly that and **adds no DOM node** — the same constraint
 * Story 139 worked under when it chose `<Card className="p-surface">` over
 * `<Card><CardContent>`: `.closest()` selectors and heading structure in the
 * existing tests depend on the node count staying put.
 *
 * `h2` is the default because that is what all 49 sites use: a section sits
 * under the page's own `PageHeader` `h1`. `headingLevel` is there for the
 * rare nested section, not as an invitation to vary.
 *
 * Deliberately NOT built on `CardHeader`/`CardContent`: those wrap their
 * children in extra `<div>`s, which is what kept them at zero adoption.
 * `actions` is the one composition this needed — a heading row with a
 * trailing control, which several call sites already hand-roll.
 */
export interface SectionCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** The section's heading. */
  title: React.ReactNode;
  /** Heading level. `h2` by default — see this component's doc comment. */
  headingLevel?: CardTitleLevel;
  /** Optional trailing control on the heading row (a filter, a toggle). */
  actions?: React.ReactNode;
  /** Optional raised treatment, passed through to `Card`. */
  elevation?: CardProps["elevation"];
}

export function SectionCard({
  title,
  headingLevel = "h2",
  actions,
  elevation,
  className,
  children,
  ...props
}: SectionCardProps) {
  return (
    <Card elevation={elevation} className={cn("p-surface", className)} {...props}>
      {actions ? (
        <div className="flex items-start justify-between gap-inline">
          <CardTitle as={headingLevel}>{title}</CardTitle>
          <div className="flex shrink-0 items-center gap-inline">{actions}</div>
        </div>
      ) : (
        <CardTitle as={headingLevel}>{title}</CardTitle>
      )}
      {children}
    </Card>
  );
}
