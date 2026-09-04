"use client";

import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "../lib/cn";
import {
  menuContentClassName,
  menuItemClassName,
  menuLabelClassName,
  menuSeparatorClassName,
} from "../lib/menu";

/**
 * Story S-3 — a generic menu, for the three future uses the recon named: a
 * table row's actions (D4), the workspace account/branch actions (S-9), and
 * grouped navigation. Nothing is migrated onto it here.
 *
 * Radix supplies what makes a menu a menu and what hand-rolled dropdowns in
 * this codebase would otherwise have to reimplement: `role="menu"` with
 * `menuitem` children, arrow-key roving focus, type-ahead, Escape to close,
 * click-outside to close, focus return to the trigger, and `aria-expanded`
 * on the trigger. It also portals to `body`, so a menu opened from the last
 * row of a table is not clipped by the table's `overflow-x-auto` wrapper —
 * the containment bug the recon flagged for `Select`.
 *
 * `sideOffset={4}` matches `Select`'s own `translate-y-1`, so a menu and a
 * select opened from adjacent controls sit the same distance from them.
 */
export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;
export const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(menuContentClassName, className)}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = "DropdownMenuContent";

export interface DropdownMenuItemProps extends React.ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Item
> {
  /** Renders the item in the danger colour. For an action that deletes or
   * revokes — which should still be gated behind `ConfirmDialog`; this only
   * changes how the item looks, never what it does. */
  destructive?: boolean;
}

export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  DropdownMenuItemProps
>(({ className, destructive = false, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(menuItemClassName, destructive && "text-danger-foreground", className)}
    {...props}
  />
));
DropdownMenuItem.displayName = "DropdownMenuItem";

export const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Label ref={ref} className={cn(menuLabelClassName, className)} {...props} />
));
DropdownMenuLabel.displayName = "DropdownMenuLabel";

export const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn(menuSeparatorClassName, className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";
