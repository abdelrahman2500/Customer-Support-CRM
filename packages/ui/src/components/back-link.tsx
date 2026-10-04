import * as React from "react";
import { Slot, Slottable } from "@radix-ui/react-slot";
import { cn } from "../lib/cn";
import { ChevronLeftIcon } from "../lib/icons";

/**
 * Story 189 (RD-1.12) — "back to the list". Replaces five copy-pasted links
 * that drew a `&larr;` glyph and disagreed on whether they had a focus ring.
 *
 * The chevron is directional, so it flips under `dir="rtl"` and always points
 * to the reading start ("back"); it is aria-hidden because the label names
 * the action. Router-free: pass `asChild` and the app's own link (e.g.
 * next/link) — `Slottable` puts the chevron inside that element.
 */
export interface BackLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  asChild?: boolean;
}

export const BackLink = React.forwardRef<HTMLAnchorElement, BackLinkProps>(
  ({ asChild = false, className, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "a";
    return (
      <Comp
        ref={ref}
        className={cn(
          "focus-ring inline-flex items-center gap-1 self-start rounded-inner text-sm font-medium text-ink-muted transition-colors duration-fast hover:text-ink hover:underline",
          className,
        )}
        {...props}
      >
        <ChevronLeftIcon className="h-4 w-4 shrink-0 rtl:rotate-180" aria-hidden="true" />
        <Slottable>{children}</Slottable>
      </Comp>
    );
  },
);
BackLink.displayName = "BackLink";
