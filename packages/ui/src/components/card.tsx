import * as React from "react";
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
const cardVariants = cva("rounded-md border border-rule bg-surface", {
  variants: {
    elevation: {
      flat: "",
      raised: "shadow-sm",
    },
  },
  defaultVariants: { elevation: "flat" },
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {}

export function Card({ className, elevation, ...props }: CardProps) {
  return <div className={cn(cardVariants({ elevation }), className)} {...props} />;
}

/**
 * Title row. `justify-between` so a trailing action (an export button, a
 * menu) sits opposite the title without the caller re-creating a flex row —
 * the shape `ReportCard` already uses for exactly that.
 */
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-start justify-between gap-2 p-4 pb-0", className)} {...props} />
  );
}

/** `text-sm font-semibold` — the size and weight this app's section headings
 * already use. Renders an `h3` by default; a page whose card *is* the primary
 * heading passes `asChild`-style overrides through `className` and its own
 * element instead. */
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-sm font-semibold text-ink", className)} {...props} />;
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
  return <div className={cn("p-4", className)} {...props} />;
}

/** Divided from the body, because a footer holds actions and needs to read as
 * separate from the content it acts on. */
export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 border-t border-rule-subtle px-4 py-3",
        className,
      )}
      {...props}
    />
  );
}
