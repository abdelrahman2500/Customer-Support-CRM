"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader, Tabs, TabsContent, TabsList, TabsTrigger } from "@crm/ui";
import { BrandingView } from "@/components/admin/branding-view";
import { AiSettingsView } from "@/components/admin/ai-settings-view";
import { BusinessHoursView } from "@/components/business-hours/business-hours-view";
import { localeDirection } from "@/i18n/direction";
import { hasAnyPermission, usePermissions } from "@/lib/permissions";

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
const SETTINGS_TABS = ["branding", "ai", "businessHours"] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number];

/** Final UX pass — what each tab's screen reads (its GET's permission). */
const TAB_REQUIREMENTS: Record<SettingsTab, string> = {
  branding: "branding:read",
  ai: "ai:read",
  businessHours: "sla:read",
};

export function SettingsView() {
  const t = useTranslations("settings");
  const locale = useLocale();
  // Story 224 (RD-6.5) — the open tab is in the URL (?tab=), so a tab can be
  // linked to and survives a reload; switching replaces the URL, no new page.
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Final UX pass — only the tabs this role can read; a tab it cannot
  // would only show its 403 as "Couldn't load your … settings".
  const permissions = usePermissions();
  const tabs = SETTINGS_TABS.filter((tab) =>
    hasAnyPermission(permissions, [TAB_REQUIREMENTS[tab]]),
  );
  const defaultTab = tabs[0] ?? "branding";
  const requested = searchParams?.get("tab");
  const fromUrl = requested && tabs.includes(requested as SettingsTab) ? requested : defaultTab;
  const [tab, setTab] = useState(fromUrl);
  // Back/Forward (or a link) changing ?tab= moves the tab too.
  useEffect(() => setTab(fromUrl), [fromUrl]);
  function selectTab(next: string) {
    setTab(next);
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (next === defaultTab) params.delete("tab");
    else params.set("tab", next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={t("title")} description={t("description")} />

      <Tabs value={tab} onValueChange={selectTab} dir={localeDirection(locale)}>
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {t(`tabs.${tab}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.includes("branding") && (
          <TabsContent value="branding">
            <BrandingView hosted />
          </TabsContent>
        )}
        {tabs.includes("ai") && (
          <TabsContent value="ai">
            <AiSettingsView hosted />
          </TabsContent>
        )}
        {tabs.includes("businessHours") && (
          <TabsContent value="businessHours">
            <BusinessHoursView hosted />
          </TabsContent>
        )}
      </Tabs>
    </section>
  );
}
