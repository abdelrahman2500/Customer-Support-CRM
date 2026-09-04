"use client";

import { CloseIcon } from "../lib/icons";
import { useToastStore } from "../lib/toast-store";

/**
 * Story 94 — the generic success-feedback renderer, mounted once alongside
 * `NotificationToaster` (see `(agent)/layout.tsx`). Deliberately positioned
 * at the *bottom* corner (`bottom-4 end-4`), not `top-4 end-4` like
 * `NotificationToaster`, so the two can never visually overlap or be
 * confused for one another — this story's explicit "must not interfere
 * with existing domain-specific real-time notification/toaster components"
 * requirement. Logical positioning (`end-4`, not `right-4`) mirrors
 * `NotificationToaster`'s own RTL-safe convention exactly.
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

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label={regionLabel}
      className="pointer-events-none fixed bottom-4 end-4 z-50 flex w-full max-w-sm flex-col gap-2"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          aria-live="polite"
          className="pointer-events-auto flex items-start justify-between gap-2 rounded-md border border-success-border bg-success-subtle p-3 text-sm text-success-foreground shadow-md"
        >
          <p>{toast.message}</p>
          <button
            type="button"
            aria-label={dismissLabel}
            onClick={() => dismiss(toast.id)}
            // Story S-4: the dismiss button was the one interactive
            // element in the shared package with no focus ring, so a
            // keyboard user tabbing to it got no indication of where they
            // were. `focus-ring` is the same S-1 utility every other
            // control here uses.
            className="focus-ring rounded-sm text-success-solid hover:text-success-foreground"
          >
            {/* Story S-5: was a `×` multiplication sign, which renders at an
                unpredictable weight and is read aloud by some screen
                readers. The button already carries `aria-label`, so the
                glyph itself is decorative. */}
            <CloseIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
