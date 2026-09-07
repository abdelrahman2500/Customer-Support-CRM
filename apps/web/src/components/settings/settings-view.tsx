"use client";

import { useLocale, useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@crm/ui";
import { BrandingView } from "@/components/admin/branding-view";
import { AiSettingsView } from "@/components/admin/ai-settings-view";
import { BusinessHoursView } from "@/components/business-hours/business-hours-view";
import { localeDirection } from "@/i18n/direction";

/**
 * RM-23 — Consolidated System Settings Screen. Core 10 (Security &
 * Administration) names "System configuration" explicitly; today it is
 * scattered across three independently-administered screens
 * (`/branding`, `/ai-settings`, `/business-hours`). This composes all
 * three onto one page via `Tabs` — the first page in this app to embed
 * more than one existing `*View` component (confirmed via recon: every
 * other `page.tsx` renders exactly one).
 *
 * Each tab renders its existing view component completely unchanged —
 * `BrandingView`/`AiSettingsView`/`BusinessHoursView` all take no props
 * and own their own queries/mutations already, so no prop threading or
 * refactor of any of the three was needed. Each also already renders its
 * own `<h1>` page title; left as-is rather than adding a
 * heading-suppression prop to three already-shipped, already-tested
 * components purely for this page's benefit — inside a `TabsContent`
 * panel, that heading reads as the panel's own section title, not a
 * jarring duplicate of this page's own title below.
 *
 * The three original routes (`/branding`, `/ai-settings`,
 * `/business-hours`) and their own nav entries are deliberately left in
 * place, not removed: nothing in this story's acceptance criteria
 * requires deleting them, and doing so would risk breaking existing
 * deep links/tests for no benefit — this page is an additional, faster
 * path to the same three screens, not a replacement for them.
 */
export function SettingsView() {
  const t = useTranslations("settings");
  const locale = useLocale();

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-slate-900">{t("title")}</h1>
      <p className="text-sm text-ink-subtle">{t("description")}</p>

      <Tabs defaultValue="branding" dir={localeDirection(locale)}>
        <TabsList>
          <TabsTrigger value="branding">{t("tabs.branding")}</TabsTrigger>
          <TabsTrigger value="ai">{t("tabs.ai")}</TabsTrigger>
          <TabsTrigger value="businessHours">{t("tabs.businessHours")}</TabsTrigger>
        </TabsList>
        <TabsContent value="branding">
          <BrandingView />
        </TabsContent>
        <TabsContent value="ai">
          <AiSettingsView />
        </TabsContent>
        <TabsContent value="businessHours">
          <BusinessHoursView />
        </TabsContent>
      </Tabs>
    </section>
  );
}
