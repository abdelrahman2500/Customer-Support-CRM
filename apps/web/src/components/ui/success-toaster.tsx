"use client";

import { useTranslations } from "next-intl";
import { SuccessToaster as UiSuccessToaster } from "@crm/ui";

/**
 * Story S-2 — this app's localization binding for `@crm/ui`'s
 * `SuccessToaster`, mirroring `@/components/confirm-dialog`'s own reason for
 * existing (see that file's doc comment). The toaster's behaviour — the
 * `role="region"` wrapper, `role="status"` + `aria-live="polite"` per toast,
 * bottom-corner logical positioning, dismissal — lives once in the shared
 * package; only the two accessible names are supplied here, from this app's
 * own `common` namespace.
 *
 * Kept at this path so `(agent)/layout.tsx`'s import is unchanged.
 */
export function SuccessToaster() {
  const t = useTranslations("common");
  return (
    <UiSuccessToaster regionLabel={t("successToastRegionLabel")} dismissLabel={t("dismiss")} />
  );
}
