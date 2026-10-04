"use client";

import { cn } from "../lib/cn";
import { CloseIcon, ErrorIcon, InfoIcon, SuccessIcon, WarningIcon } from "../lib/icons";
import type { LucideIcon } from "../lib/icons";
import {
  toastCardClassName,
  toastListClassName,
  toastRegionClassName,
  toastToneClassName,
  type ToastTone,
} from "../lib/toast";
import { useToastStore } from "../lib/toast-store";

const TONE_ICON: Record<ToastTone, LucideIcon> = {
  success: SuccessIcon,
  info: InfoIcon,
  warning: WarningIcon,
  error: ErrorIcon,
};

const TONE_ICON_CLASS: Record<ToastTone, string> = {
  success: "text-success-foreground",
  info: "text-info-foreground",
  warning: "text-warning-foreground",
  error: "text-danger-foreground",
};

/**
 * Story 94 — the generic feedback renderer, mounted once alongside
 * `NotificationToaster` (see `(agent)/layout.tsx`). Deliberately positioned
 * at the *bottom* edge, not the top like `NotificationToaster`, so the two
 * can never visually overlap or be confused for one another.
 *
 * Story 190 (RD-1.13):
 * - the labelled region and its polite live list are always mounted, even
 *   with no toasts, so the first toast is inserted into a live region that
 *   already exists and is announced (recon A11Y-10);
 * - the shared `lib/toast.ts` position is 320px-safe (recon RS-01);
 * - toasts carry a tone (success/info/warning/error) as a semantic border
 *   plus a leading icon, never colour alone. Error toasts are `role="alert"`
 *   (assertive); the rest rely on the list's polite announcement, so no
 *   live roles are nested and nothing is read twice.
 */
export function SuccessToaster({
  regionLabel,
  dismissLabel,
}: {
  /** Already-translated accessible name for the toast region. */
  regionLabel: string;
  /** Already-translated accessible name for each toast's dismiss button. */
  dismissLabel: string;
}) {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  return (
    <div role="region" aria-label={regionLabel} className={cn(toastRegionClassName, "bottom-4")}>
      <ol aria-live="polite" className={toastListClassName}>
        {toasts.map((toast) => {
          const Icon = TONE_ICON[toast.tone];
          return (
            <li
              key={toast.id}
              role={toast.tone === "error" ? "alert" : undefined}
              className={cn(
                toastCardClassName,
                toastToneClassName[toast.tone],
                "items-start gap-2",
              )}
            >
              <Icon
                className={cn("mt-0.5 h-4 w-4 shrink-0", TONE_ICON_CLASS[toast.tone])}
                aria-hidden="true"
              />
              <p className="min-w-0 flex-1 break-words">{toast.message}</p>
              <button
                type="button"
                aria-label={dismissLabel}
                onClick={() => dismiss(toast.id)}
                // Story S-4: keyboard users need to see where they are.
                className="focus-ring rounded-inner text-ink-subtle hover:text-ink"
              >
                {/* Story S-5: the button carries aria-label, so the glyph is
                    decorative. */}
                <CloseIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
