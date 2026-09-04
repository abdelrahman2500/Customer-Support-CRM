"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "../lib/cn";

/**
 * Story S-3 — accessible tabs. Established here so S-12 can group the ticket
 * detail's secondary cards (history, CSAT, escalations, attachments) without
 * also having to get roving focus and panel association right at the same
 * time. Nothing is converted to tabs in this story.
 *
 * Radix owns the parts that are easy to get subtly wrong: `role="tablist"`
 * with `tab`/`tabpanel` children, arrow-key movement between tabs with only
 * the active tab in the page's tab order, `aria-selected`/`aria-controls`
 * wiring, and — the one that matters for RTL — arrow keys following the
 * document direction, so Left moves to the *next* tab under `dir="rtl"`.
 *
 * An underline rather than a filled pill: the ticket detail this will host
 * already sits inside bordered cards, and a second filled surface there
 * competes with the card it lives in.
 */
export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn("flex items-center gap-1 border-b border-rule", className)}
    {...props}
  />
));
TabsList.displayName = "TabsList";

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      // `-mb-px` pulls the active underline onto the list's own border so the
      // two read as one line rather than two stacked rules.
      "focus-ring -mb-px whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-accent data-[state=active]:text-ink",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = "TabsTrigger";

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content ref={ref} className={cn("focus-ring pt-4", className)} {...props} />
));
TabsContent.displayName = "TabsContent";
