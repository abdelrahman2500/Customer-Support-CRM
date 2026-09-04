"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "../lib/cn";
import { menuContentClassName } from "../lib/menu";

/**
 * Story S-3 — a non-modal floating panel for rich content: a filter group, a
 * date range, a details preview. Distinct from `DropdownMenu` (which is a
 * list of commands with menu semantics) and from `Dialog` (which is modal
 * and takes over the page).
 *
 * Radix gives it the behaviours this package should not hand-roll: focus
 * moves into the panel on open and returns to the trigger on close, Escape
 * closes, click-outside closes, `aria-expanded`/`aria-controls` are wired on
 * the trigger, and the content is portalled to `body` so a parent with
 * `overflow: hidden` or `overflow-x-auto` cannot clip it.
 *
 * `collisionPadding` keeps the panel off the viewport edge, and the shared
 * `menuContentClassName` bounds its height to
 * `--radix-popper-available-height` so a tall panel scrolls internally
 * rather than extending the page.
 */
export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverClose = PopoverPrimitive.Close;

export const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "start", sideOffset = 4, collisionPadding = 8, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      collisionPadding={collisionPadding}
      // `p-3`, not the menu's `p-1`: a popover holds prose and controls
      // rather than flush menu rows.
      className={cn(menuContentClassName, "w-72 p-3", className)}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = "PopoverContent";
