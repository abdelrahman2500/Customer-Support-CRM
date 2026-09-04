import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";
import { Spinner } from "./spinner";

/**
 * Story S-1 — the palette literals moved to semantic tokens. Every colour
 * resolves to the exact value it had before (`accent` is the `slate-900`
 * this button always used, `danger-solid` is `red-600`), so nothing changed
 * visually; what changed is that Story S-15 can repoint `--accent` at a
 * branch's configured brand colour without editing this file.
 *
 * The focus treatment is the shared `.focus-ring` utility
 * (`globals.css`). On this component that is a real fix rather than a
 * refactor: the old ring painted straight onto the dark `default` variant's
 * own edge, where a mid-grey ring is close to invisible. `.focus-ring` adds a
 * surface-coloured offset, so the ring is always read against the page.
 *
 * Story S-3 — adds a loading state and an `lg` size. The four variants and
 * the `default`/`sm` sizes are byte-identical to before.
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
        /**
         * Story S-3 — `h-10`, one 4px step above `default`, for a page's
         * single primary action (a portal "Submit a ticket", a login submit).
         * Deliberately not applied anywhere yet: introducing the size is this
         * story's job, deciding which actions deserve it belongs to the
         * surface stories.
         */
        lg: "h-10 px-6 text-sm",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /**
   * Story S-3 — shows a spinner, marks the button `aria-busy`, and blocks
   * further activation.
   *
   * It implies `disabled` rather than sitting alongside it, because a loading
   * button that can still be clicked is the double-submit bug this is meant
   * to prevent. `disabled` remains independently settable for the ordinary
   * "not allowed yet" case, and the two compose.
   *
   * Ignored when `asChild` is set: `Slot` merges props onto a single child
   * element, and the spinner needs a second child to render alongside. A
   * caller needing both should render `Spinner` inside its own child.
   */
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, isLoading = false, disabled, children, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    const loading = isLoading && !asChild;

    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), loading && "relative", className)}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <>
            {/*
             * The label stays in the DOM, merely `invisible`, and the spinner
             * is absolutely centred over it. That is what holds the button's
             * width and height fixed while loading — swapping the label out
             * for a spinner would resize the button mid-click and shift
             * everything beside it. `inline-flex … gap-2` on the wrapper
             * preserves the spacing of a caller that passes an icon plus
             * text.
             */}
            <span className="absolute inset-0 flex items-center justify-center">
              <Spinner />
            </span>
            <span className="invisible inline-flex items-center gap-2">{children}</span>
          </>
        ) : (
          children
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";
