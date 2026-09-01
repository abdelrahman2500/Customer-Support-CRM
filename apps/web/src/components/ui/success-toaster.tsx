"use client";

import { useTranslations } from "next-intl";
import { useToastStore } from "@/lib/toast-store";

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
export function SuccessToaster() {
  const t = useTranslations("common");
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label={t("successToastRegionLabel")}
      className="pointer-events-none fixed bottom-4 end-4 z-50 flex w-full max-w-sm flex-col gap-2"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          aria-live="polite"
          className="pointer-events-auto flex items-start justify-between gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 shadow-md"
        >
          <p>{toast.message}</p>
          <button
            type="button"
            aria-label={t("dismiss")}
            onClick={() => dismiss(toast.id)}
            className="text-emerald-600 hover:text-emerald-800"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
