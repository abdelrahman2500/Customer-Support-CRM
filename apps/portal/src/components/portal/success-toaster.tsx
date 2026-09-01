"use client";

import { useTranslations } from "next-intl";
import { useToastStore } from "@/lib/toast-store";

/**
 * Story 94 — portal counterpart of `apps/web`'s `SuccessToaster`
 * (`apps/web/src/components/ui/success-toaster.tsx`). Not placed under a
 * `ui/` directory — `apps/portal` has none, by deliberate Story 52
 * convention (see `ticket-list-view.tsx`'s own doc comment); this file
 * lives alongside `notification-toaster.tsx`, the component it mirrors and
 * is positioned relative to. Bottom corner (`bottom-4 end-4`), not top,
 * so it can never visually collide with `NotificationToaster`'s
 * `top-4 end-4` real-time domain-event stack.
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
