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
  "focus-ring inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control text-sm font-medium transition-colors duration-fast ease-standard disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // Story 185 (RD-1.8) — the design-language action set: one solid
        // primary, a quiet tinted secondary, a bordered outline, a bare ghost,
        // a text-only link, and the destructive fill. Pressed states use the
        // -active step; every colour is a token, so branding and dark mode
        // apply with no per-variant overrides.
        default: "bg-accent text-accent-foreground hover:bg-accent-hover active:bg-accent-active",
        secondary:
          "bg-accent-surface text-accent-hover hover:bg-surface-muted active:bg-surface-muted",
        outline:
          "border border-rule-strong bg-surface text-ink hover:bg-surface-muted active:bg-surface-sunk",
        ghost: "text-ink-strong hover:bg-surface-muted active:bg-surface-sunk",
        link: "text-accent underline-offset-4 hover:underline",
        destructive:
          "bg-danger-solid text-danger-solid-foreground hover:bg-danger-solid-hover active:bg-danger-solid-hover",
      },
      size: {
        // Story 185 (RD-1.8) — comfortable density: 40px default, 32px sm,
        // 44px lg (was 36/32/40). Icon sizes are square; an icon-only button
        // MUST carry an aria-label, since its icon is aria-hidden.
        default: "h-10 px-4",
        sm: "h-8 px-3 text-xs",
        icon: "h-10 w-10 p-0",
        "icon-sm": "h-8 w-8 p-0",
        /**
         * Story S-3 — for a page's single primary action (a portal "Submit a
         * ticket", a login submit). Story 185 — 44px, one step above the
         * comfortable default.
         */
        lg: "h-11 px-6 text-sm",
      },
    },
    // A link is text, not a box: whatever the size, it drops the height and
    // padding (compound classes are emitted after size classes, so they win).
    compoundVariants: [{ variant: "link", class: "h-auto px-0" }],
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
             * The label stays in the DOM, merely transparent, and the spinner
             * is absolutely centred over it. That is what holds the button's
             * width and height fixed while loading — swapping the label out
             * for a spinner would resize the button mid-click and shift
             * everything beside it. `inline-flex … gap-2` on the wrapper
             * preserves the spacing of a caller that passes an icon plus
             * text.
             *
             * Story 169 — `opacity-0`, NOT `invisible`. The two look
             * identical, but `visibility: hidden` removes a subtree from the
             * accessibility tree, so every one of the 13 `isLoading` call
             * sites had a button with NO accessible name for the whole
             * duration of its own pending state — a screen reader announced
             * "button, busy" and nothing else, on exactly the control the
             * user had just activated. `opacity: 0` is not an exclusion
             * criterion in the accessible-name computation: the label stays
             * exposed, so the button is still "Save changes, busy".
             *
             * Not observable under test here: jsdom loads no Tailwind CSS, so
             * `invisible` computes to nothing and `toHaveAccessibleName`
             * passes either way. The guard is therefore the class-level
             * assertion in this component's own spec, which is the only place
             * the distinction is expressible.
             */}
            <span className="absolute inset-0 flex items-center justify-center">
              <Spinner />
            </span>
            <span className="inline-flex items-center gap-2 opacity-0">{children}</span>
          </>
        ) : (
          children
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";
