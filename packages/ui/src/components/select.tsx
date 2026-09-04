"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../lib/cn";
import { menuContentClassName, menuItemClassName } from "../lib/menu";

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;
export const SelectGroup = SelectPrimitive.Group;

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "focus-ring-always flex h-9 w-full items-center justify-between gap-2 rounded-md border border-rule-strong bg-surface px-3 py-1 text-sm text-ink shadow-sm disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" aria-hidden />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = "SelectTrigger";

/**
 * Story S-3 — scroll affordances at the panel's edges.
 *
 * Radix renders these only when the list actually overflows, so a four-option
 * status filter looks exactly as it did before. They matter for the lists the
 * recon called out (D2/M-4): the assignee and category filters are sourced
 * from `useUsersQuery`/`useTicketCategoriesQuery` and can run to hundreds of
 * rows.
 */
export const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1 text-ink-muted", className)}
    {...props}
  >
    <ChevronUp className="h-4 w-4" aria-hidden />
  </SelectPrimitive.ScrollUpButton>
));
SelectScrollUpButton.displayName = "SelectScrollUpButton";

export const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1 text-ink-muted", className)}
    {...props}
  >
    <ChevronDown className="h-4 w-4" aria-hidden />
  </SelectPrimitive.ScrollDownButton>
));
SelectScrollDownButton.displayName = "SelectScrollDownButton";

/**
 * Story S-3 — containment. Previously the panel had `min-w` and a border but
 * no height ceiling, so a long option list grew until it ran past the fold
 * with no way to reach the bottom of it (recon D2).
 *
 * Three things fix that together:
 *
 * - `max-h-[var(--radix-select-content-available-height)]` — Radix measures
 *   the room between the trigger and the viewport edge and publishes it as
 *   that custom property. The panel can therefore never be taller than the
 *   space it has, which is also what stops it extending the page.
 * - `Viewport`'s `overflow-y-auto` plus the scroll buttons above, so the
 *   overflow is reachable by wheel, drag *and* keyboard.
 * - `min-w-[var(--radix-select-trigger-width)]` — the panel is at least as
 *   wide as its trigger, so a filter's options are not narrower than the
 *   control that opened them.
 *
 * The `Portal` means none of this is clipped by an ancestor's
 * `overflow-x-auto` — which is what makes a select inside the ticket table,
 * or inside a `Dialog`, behave. Radix's own layering puts select content
 * above dialog content because both portal to `body` and the select mounts
 * later.
 */
export const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      className={cn(
        menuContentClassName,
        // The shared panel class bounds height against the generic popper
        // variable; a select publishes its own, which accounts for the
        // trigger it is anchored to.
        "max-h-[var(--radix-select-content-available-height)] p-0",
        position === "popper" && "min-w-[var(--radix-select-trigger-width)] translate-y-1",
        className,
      )}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport className="max-h-[inherit] overflow-y-auto p-1">
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = "SelectContent";

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(menuItemClassName, "data-[state=checked]:font-medium", className)}
    {...props}
  >
    {/* `start-2`, not `left-2`: the check sits at the reading-start edge, so
        it mirrors under `dir="rtl"` along with `menuItemClassName`'s `ps-8`. */}
    <span className="absolute start-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" aria-hidden />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = "SelectItem";
