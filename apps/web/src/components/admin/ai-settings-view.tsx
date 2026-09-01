"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAiSettingsQuery, useUpdateAiSettingsMutation } from "@/hooks/use-ai-settings";
import type { AiSettingsSummary } from "@/lib/ai-settings-api";
import { ApiError } from "@/lib/api";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type ToggleKey = keyof AiSettingsSummary;

const TOGGLES: { key: ToggleKey; labelKey: string }[] = [
  { key: "summarizeEnabled", labelKey: "summarizeLabel" },
  { key: "suggestReplyEnabled", labelKey: "suggestReplyLabel" },
  { key: "categorizeEnabled", labelKey: "categorizeLabel" },
  { key: "chatEnabled", labelKey: "chatLabel" },
];

/**
 * Story 81 — AI Feature Flags per Branch. Mirrors `BrandingView`'s
 * loading/error/form shape exactly, with four toggle checkboxes instead
 * of three text inputs — no `Switch` component exists yet in
 * `@/components/ui`, so a plain labeled checkbox mirrors the simplest
 * existing form-control precedent. Each toggle saves immediately on
 * change (no separate "Save" step): a boolean flag has no invalid
 * intermediate state to protect against, unlike `BrandingForm`'s
 * free-text/color fields.
 */
export function AiSettingsView() {
  const t = useTranslations("aiSettings");
  const settingsQuery = useAiSettingsQuery();

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-slate-900">{t("title")}</h1>
      <p className="text-sm text-slate-500">{t("description")}</p>

      {settingsQuery.isLoading && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} className="h-10 w-full" />
          ))}
        </div>
      )}

      {settingsQuery.isError && (
        <Alert variant="destructive" className="flex items-center justify-between">
          <span>{t("error")}</span>
          <Button variant="outline" size="sm" onClick={() => settingsQuery.refetch()}>
            {t("retry")}
          </Button>
        </Alert>
      )}

      {settingsQuery.isSuccess && <AiSettingsForm initial={settingsQuery.data} />}
    </section>
  );
}

function AiSettingsForm({ initial }: { initial: AiSettingsSummary }) {
  const t = useTranslations("aiSettings");
  const mutation = useUpdateAiSettingsMutation();
  const [draft, setDraft] = useState<AiSettingsSummary>(initial);
  const [error, setError] = useState<string | null>(null);

  // Keep the draft in sync if the server value changes underneath us
  // (e.g. a successful save re-fetches) — mirrors `BrandingForm`'s own
  // "re-sync from the authoritative refetch" convention.
  useEffect(() => {
    setDraft(initial);
  }, [initial]);

  async function handleToggle(key: ToggleKey, value: boolean): Promise<void> {
    setError(null);
    setDraft((current) => ({ ...current, [key]: value }));
    try {
      await mutation.mutateAsync({ [key]: value });
    } catch (submitError) {
      setDraft(initial);
      setError(submitError instanceof ApiError ? submitError.message : t("saveFailed"));
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-4">
      {TOGGLES.map((toggle) => (
        <label key={toggle.key} className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={draft[toggle.key]}
            disabled={mutation.isPending}
            onChange={(event) => void handleToggle(toggle.key, event.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          {t(toggle.labelKey)}
        </label>
      ))}
      {error && <Alert variant="destructive">{error}</Alert>}
    </div>
  );
}
