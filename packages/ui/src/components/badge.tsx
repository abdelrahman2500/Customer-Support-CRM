import * as React from "react";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

/**
 * Story S-1 — the four status tints moved to the semantic families.
 * `success`/`warning`/`destructive` were `emerald-100`/`amber-100`/`red-100`
 * with `-800` text; they now read `success-surface`/`warning-surface`/
 * `danger-surface` with the matching `-foreground`, which resolve to those
 * same values. Same pixels, but a ticket badge now says what it *means*
 * rather than which shade of amber it picked — and S-3 can consolidate the
 * four duplicated `statusBadgeVariant` maps (recon M-3) against this
 * vocabulary instead of against raw palette steps.
 *
 * Every `-surface`/`-foreground` pair here clears WCAG AA for body text:
 * success 6.4:1, warning 6.5:1, danger 6.9:1.
 */
const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "border-transparent bg-accent text-accent-foreground",
        secondary: "border-transparent bg-surface-muted text-ink",
        outline: "border-rule-strong text-ink-strong",
        success: "border-transparent bg-success-surface text-success-foreground",
        warning: "border-transparent bg-warning-surface text-warning-foreground",
        destructive: "border-transparent bg-danger-surface text-danger-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
