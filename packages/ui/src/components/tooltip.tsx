"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "../lib/cn";

/**
 * Story S-3 — a hint for a truncated value or an icon-only control. Needed
 * before icon-only actions exist (recon L-2), which is why it lands with the
 * primitives rather than after them.
 *
 * Radix's tooltip is keyboard- and touch-aware in ways a hover-only
 * `title`-attribute substitute is not: it opens on focus as well as hover,
 * closes on Escape, is exposed via `aria-describedby` on the trigger, and
 * does not fire on touch (where there is no hover state to speak of).
 *
 * Two constraints a caller has to respect, both inherent to tooltips rather
 * than to this wrapper:
 *
 * - A tooltip is *supplementary*. It must never be the only place a control's
 *   name lives, because it is unreachable for a screen-reader user browsing
 *   without focus. Icon-only buttons still need `aria-label`.
 * - `TooltipTrigger` must wrap a focusable element. A `<div>` trigger is
 *   keyboard-unreachable, so the tooltip would be hover-only.
 *
 * `TooltipProvider` sets the shared open/close delay and should be mounted
 * once per app, high in the tree. `Tooltip` also works standalone in tests.
 */
export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      // Inverted (ink ground, surface text) so a tooltip reads as an overlay
      // annotation rather than as another card.
      className={cn(
        "z-50 max-w-xs rounded-md bg-ink px-2.5 py-1.5 text-xs text-surface shadow-md",
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = "TooltipContent";
