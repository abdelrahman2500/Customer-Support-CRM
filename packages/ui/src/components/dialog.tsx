"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../lib/cn";
import { overlayClassName, overlayPanelClassName } from "../lib/overlay";

/**
 * Story S-3 — a general-purpose modal, alongside (not replacing)
 * `AlertDialog`/`ConfirmDialog`.
 *
 * Both sit on `@radix-ui/react-dialog` and share their panel styling via
 * `../lib/overlay`, so the two can never drift apart visually. Two real
 * differences justify keeping them separate rather than adding a variant:
 *
 * - **Role.** `AlertDialogContent` sets `role="alertdialog"` explicitly,
 *   which tells a screen reader "this interrupts you and requires a
 *   decision". A dialog holding a form is not that, and mislabelling it makes
 *   the announcement wrong.
 * - **Escapability.** A confirmation must be answered, so `ConfirmDialog`
 *   suppresses Escape and overlay-dismiss while its mutation is in flight.
 *   A general dialog should always be closable, so this one carries a visible
 *   close button and leaves Radix's dismiss behaviour alone.
 *
 * Nothing existing is migrated to this. `ConfirmDialog` keeps its own
 * `AlertDialog` foundation untouched, and no current caller changes.
 *
 * Focus, Escape, overlay-dismiss, `aria-modal`, focus trapping and
 * focus-return-to-trigger are all Radix's, unmodified — which is why this
 * primitive is deliberately thin.
 */
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogPortal = DialogPrimitive.Portal;

export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay ref={ref} className={cn(overlayClassName, className)} {...props} />
));
DialogOverlay.displayName = "DialogOverlay";

export interface DialogContentProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
> {
  /**
   * Accessible name for the close button. Required when the button is shown,
   * because this package owns no copy and cannot translate "Close" — the same
   * contract `ConfirmDialog`'s labels and `SuccessToaster`'s
   * `regionLabel`/`dismissLabel` already follow.
   */
  closeLabel?: string;
  /** Set `false` for a dialog whose only exits are its own footer actions.
   * Escape and overlay-click still work; only the corner button is hidden. */
  showClose?: boolean;
}

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, closeLabel, showClose = true, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content ref={ref} className={cn(overlayPanelClassName, className)} {...props}>
      {children}
      {showClose && closeLabel ? (
        <DialogPrimitive.Close
          aria-label={closeLabel}
          // `end-4`, not `right-4`: the button follows the reading direction
          // so it lands top-left under `dir="rtl"`.
          className="focus-ring absolute end-4 top-4 rounded-sm text-ink-subtle transition-colors hover:text-ink"
        >
          <X className="h-4 w-4" aria-hidden />
        </DialogPrimitive.Close>
      ) : null}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = "DialogContent";

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5", className)} {...props} />;
}

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-base font-semibold text-ink", className)}
    {...props}
  />
));
DialogTitle.displayName = "DialogTitle";

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-ink-muted", className)}
    {...props}
  />
));
DialogDescription.displayName = "DialogDescription";

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mt-4 flex flex-wrap items-center justify-end gap-2", className)}
      {...props}
    />
  );
}
