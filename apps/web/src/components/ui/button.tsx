import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Story S-1 — the palette literals moved to semantic tokens. Every colour
 * resolves to the exact value it had before (`accent` is the `slate-900`
 * this button always used, `danger-solid` is `red-600`), so nothing changes
 * visually; what changes is that Story S-15 can repoint `--accent` at a
 * branch's configured brand colour and this file does not need editing.
 *
 * The focus treatment is now the shared `.focus-ring` utility
 * (`src/app/globals.css`) rather than a local
 * `focus-visible:ring-2 ring-slate-400` triplet. On this component that is
 * a real fix and not just a refactor: the old ring painted straight onto
 * the dark `default` variant's own edge, where a mid-grey ring is close to
 * invisible. `.focus-ring` adds a surface-coloured offset, so the ring is
 * always read against the page.
 *
 * Deliberately unchanged: no `isLoading` prop, no `icon`/`lg` size. Both
 * are real gaps (recon M-5) and both belong to S-3 — this story is the
 * token foundation, not the primitive expansion.
 */
const buttonVariants = cva(
  "focus-ring inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-accent text-accent-foreground hover:bg-accent-hover",
        outline: "border border-rule-strong bg-surface text-ink hover:bg-surface-sunk",
        ghost: "text-ink-strong hover:bg-surface-muted",
        destructive: "bg-danger-solid text-white hover:bg-danger-solid-hover",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";
