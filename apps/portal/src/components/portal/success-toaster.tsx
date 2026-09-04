"use client";

import { useTranslations } from "next-intl";
import { SuccessToaster as UiSuccessToaster } from "@crm/ui";

/**
 * Story S-2 — this app's localization binding for `@crm/ui`'s
 * `SuccessToaster`. The component itself — previously duplicated
 * character-for-character between the two apps — now lives once in the
 * shared package; only the two accessible names are bound here, from this
 * app's own `common` namespace.
 *
 * Mirrors `apps/web/src/components/ui/success-toaster.tsx` exactly. Kept at
 * this path so `(customer)/layout.tsx`'s import is unchanged.
 */
export function SuccessToaster() {
  const t = useTranslations("common");
  return (
    <UiSuccessToaster regionLabel={t("successToastRegionLabel")} dismissLabel={t("dismiss")} />
  );
}
