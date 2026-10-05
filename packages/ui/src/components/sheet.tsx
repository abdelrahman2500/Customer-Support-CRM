"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { CloseIcon } from "../lib/icons";
import { cn } from "../lib/cn";
import { overlayClassName } from "../lib/overlay";

/**
 * Story 211 (PR-1.2) — a side panel for editing or filtering without leaving
 * the page (admin editors, the mobile "Filters" panel, the mobile nav).
 *
 * Built on the same Radix Dialog as `Dialog`, so focus is trapped, Escape and
 * the overlay close it, focus returns to the trigger, and the title names it.
 * It enters from the inline-end edge — the right in LTR, the left in RTL —
 * via one keyframe offset by `--sheet-from`. `side="start"` is for
 * navigation drawers, which sit on the reading side.
 *
 * Translation-free: the caller passes `closeLabel`.
 */
export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

const SIZE = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-xl",
} as const;

export interface SheetContentProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
> {
  /** Accessible name of the close button; the button is hidden without it. */
  closeLabel?: string;
  side?: "end" | "start";
  size?: keyof typeof SIZE;
}

export const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(({ className, children, closeLabel, side = "end", size = "md", ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className={overlayClassName} />
    <DialogPrimitive.Content
      ref={ref}
      data-side={side}
      className={cn(
        "fixed inset-y-0 z-50 flex w-full flex-col border-rule bg-surface-raised text-ink shadow-overlay focus:outline-none",
        "data-[state=open]:animate-sheet-in data-[state=closed]:animate-sheet-out",
        side === "end"
          ? "end-0 border-s [--sheet-from:100%] rtl:[--sheet-from:-100%]"
          : "start-0 border-e [--sheet-from:-100%] rtl:[--sheet-from:100%]",
        SIZE[size],
        className,
      )}
      {...props}
    >
      {children}
      {closeLabel ? (
        <DialogPrimitive.Close
          aria-label={closeLabel}
          className="focus-ring absolute end-4 top-4 rounded-inner p-1 text-ink-subtle transition-colors duration-fast hover:bg-surface-muted hover:text-ink"
        >
          <CloseIcon className="h-4 w-4" aria-hidden />
        </DialogPrimitive.Close>
      ) : null}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
SheetContent.displayName = "SheetContent";

/** The fixed top of the sheet: title and an optional description. */
export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col gap-1 border-b border-rule-subtle px-6 py-5 pe-12", className)}
      {...props}
    />
  );
}

/** The scrolling middle. */
export function SheetBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex-1 overflow-y-auto px-6 py-5", className)} {...props} />;
}

/** The fixed bottom: actions, end-aligned. */
export function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-end gap-2 border-t border-rule-subtle px-6 py-4",
        className,
      )}
      {...props}
    />
  );
}

export const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-heading text-ink", className)} {...props} />
));
SheetTitle.displayName = "SheetTitle";

export const SheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-ink-muted", className)}
    {...props}
  />
));
SheetDescription.displayName = "SheetDescription";
