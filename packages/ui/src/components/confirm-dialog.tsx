"use client";

import { useEffect, useRef } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./alert-dialog";
import { Button } from "./button";

/**
 * Story 94 — the one, shared confirmation surface for every destructive
 * action in `apps/web` (Recon: "no `Dialog`/`AlertDialog` primitive exists
 * anywhere... every deactivate/reset-password/unpublish action fires
 * immediately on click"). A caller keeps its own existing mutation call
 * unchanged — this component only gates *when* that call fires, exactly per
 * this story's own constraint ("only gate the existing `.mutate()`/
 * `.mutateAsync()` call behind confirmation; do not change the existing
 * mutation/business logic").
 *
 * Usage: a caller owns one `useState(false)` for `open`, renders its
 * existing trigger `Button` with `onClick={() => setOpen(true)}` (never
 * calling `.mutate()` directly from that click anymore), and renders this
 * component alongside it with `onConfirm={() => mutation.mutate(...)}`.
 *
 * - Keyboard/focus: focus-into-dialog and Escape-to-close are inherited
 *   from Radix `Dialog` via `AlertDialogContent`. Focus-back-to-trigger is
 *   handled explicitly here, not by Radix's own default: Radix's built-in
 *   restoration (`@radix-ui/react-dialog`'s `context.triggerRef`) only
 *   fires for a `Dialog.Trigger`-wrapped button, and this component is
 *   deliberately trigger-less/fully controlled (`open`/`onOpenChange`) so
 *   a caller's existing trigger `Button` never has to be restructured —
 *   see this file's own "Usage" note. Instead, the element focused at the
 *   moment `open` becomes `true` is captured and explicitly refocused via
 *   `onCloseAutoFocus` when the dialog closes.
 * - Prevents duplicate submission: the confirm button disables itself via
 *   `isPending` (mirrors every existing submit-button convention in this
 *   codebase), and closing via Escape/overlay-click/Cancel is suppressed
 *   entirely while `isPending` so an in-flight mutation is never
 *   interrupted mid-flight.
 * - Destructive styling: `variant="destructive"` (the existing `Button`
 *   variant the Recon found was never actually used on a real button
 *   anywhere) makes the confirm action visually obvious and distinct from
 *   Cancel's `variant="outline"`.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  workingLabel,
  onConfirm,
  isPending = false,
  destructive = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  /** Already-translated. Required rather than defaulted: this package is
   * i18n-library-agnostic, so the caller — which owns a `useTranslations()`
   * scope — resolves copy before it crosses this boundary. Exactly the
   * convention `title`/`description`/`confirmLabel` above already followed. */
  cancelLabel: string;
  /** Already-translated label shown on the confirm button while `isPending`. */
  workingLabel: string;
  onConfirm: () => void;
  isPending?: boolean;
  destructive?: boolean;
}) {
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    }
  }, [open]);

  function handleOpenChange(next: boolean) {
    if (isPending) {
      // Never let an in-flight confirmation be dismissed out from under
      // itself — Escape/overlay-click are no-ops until the mutation settles.
      return;
    }
    onOpenChange(next);
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent
        onEscapeKeyDown={(event) => {
          if (isPending) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (isPending) event.preventDefault();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          previouslyFocusedRef.current?.focus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => handleOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            disabled={isPending}
            onClick={onConfirm}
          >
            {isPending ? workingLabel : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
