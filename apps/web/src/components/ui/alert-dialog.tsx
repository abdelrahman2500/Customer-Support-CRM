"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

/**
 * Story 94 — low-level dialog primitives for `ConfirmDialog`
 * (`@/components/confirm-dialog`). Built on `@radix-ui/react-dialog`
 * (already an `apps/web` dependency — `package.json` — but previously
 * unused anywhere in this codebase), not `@radix-ui/react-alert-dialog`:
 * that package is not installed, and Radix's own `Dialog` primitive already
 * provides everything this story's requirements need (focus moves into the
 * dialog on open, focus returns to the trigger on close, Escape closes,
 * a backdrop click closes, `aria-modal`) without adding a new dependency.
 * `AlertDialogContent` below sets `role="alertdialog"` explicitly (Radix's
 * own default is `role="dialog"`) for the more semantically correct
 * "this interrupts you and requires a decision" announcement a screen
 * reader gives an `alertdialog` — the one behavioral difference from a
 * plain `Dialog` that actually matters for a confirmation prompt.
 *
 * Named `AlertDialog*` (not `Dialog*`) to keep the public API consistent
 * with the common shadcn/ui naming this component's shape mirrors, even
 * though the implementation underneath is `react-dialog`.
 */
export const AlertDialog = DialogPrimitive.Root;
export const AlertDialogTrigger = DialogPrimitive.Trigger;

export function AlertDialogPortal({ children, ...props }: DialogPrimitive.DialogPortalProps) {
  return <DialogPrimitive.Portal {...props}>{children}</DialogPrimitive.Portal>;
}

export const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-50 bg-overlay/40", className)}
    {...props}
  />
));
AlertDialogOverlay.displayName = "AlertDialogOverlay";

export const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      role="alertdialog"
      className={cn(
        "fixed start-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-md border border-rule bg-surface p-6 shadow-lg focus:outline-none rtl:translate-x-1/2",
        className,
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </AlertDialogPortal>
));
AlertDialogContent.displayName = "AlertDialogContent";

export function AlertDialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5", className)} {...props} />;
}

export const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-base font-semibold text-ink", className)}
    {...props}
  />
));
AlertDialogTitle.displayName = "AlertDialogTitle";

export const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-ink-muted", className)}
    {...props}
  />
));
AlertDialogDescription.displayName = "AlertDialogDescription";

export function AlertDialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mt-4 flex flex-wrap items-center justify-end gap-2", className)}
      {...props}
    />
  );
}
