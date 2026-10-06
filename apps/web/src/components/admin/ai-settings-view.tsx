"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { useTranslations } from "next-intl";
import { useAiSettingsQuery, useUpdateAiSettingsMutation } from "@/hooks/use-ai-settings";
import type { AiSettingsSummary } from "@/lib/ai-settings-api";
import { useErrorMessage } from "@/hooks/use-error-message";
import { Alert, Button, Card, Checkbox, Label, LoadingStatus, PageHeader, Skeleton } from "@crm/ui";

type ToggleKey = keyof AiSettingsSummary;

const TOGGLES: { key: ToggleKey; labelKey: string }[] = [
  { key: "summarizeEnabled", labelKey: "summarizeLabel" },
  { key: "suggestReplyEnabled", labelKey: "suggestReplyLabel" },
  { key: "categorizeEnabled", labelKey: "categorizeLabel" },
  { key: "chatEnabled", labelKey: "chatLabel" },
  { key: "suggestSolutionsEnabled", labelKey: "suggestSolutionsLabel" },
];

/**
 * Story 81 — AI Feature Flags per Branch. Mirrors `BrandingView`'s
 * loading/error/form shape exactly, with toggle checkboxes (a fifth,
 * `suggestSolutionsEnabled`, added by RM-00) instead
 * of three text inputs — no `Switch` component exists yet in
 * `@/components/ui`, so a plain labeled checkbox mirrors the simplest
 * existing form-control precedent. Each toggle saves immediately on
 * change (no separate "Save" step): a boolean flag has no invalid
 * intermediate state to protect against, unlike `BrandingForm`'s
 * free-text/color fields.
 */
/** Story 198 (RD-2.4, recon A11Y-04) — `hosted`: rendered inside Settings'
 * tabs, under that page's own h1, so the title becomes an h2. */
export function AiSettingsView({ hosted = false }: { hosted?: boolean } = {}) {
  const t = useTranslations("aiSettings");
  const tCommon = useTranslations("common");
  const settingsQuery = useAiSettingsQuery();

  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={t("title")} description={t("description")} headingLevel={hosted ? 2 : 1} />

      {settingsQuery.isLoading && (
        <LoadingStatus label={tCommon("loading")} className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((row) => (
            <Skeleton key={row} className="h-10 w-full" />
          ))}
        </LoadingStatus>
      )}

      {/* Final UX pass — a role without access is told so, without a
          retry that could never succeed. */}
      {settingsQuery.isError && isForbidden(settingsQuery.error) && (
        <Alert variant="info">{t("forbidden")}</Alert>
      )}
      {settingsQuery.isError && !isForbidden(settingsQuery.error) && (
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
  const errorMessage = useErrorMessage();
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
      setError(
        errorMessage(submitError, { forbidden: t("saveForbidden"), generic: t("saveFailed") }),
      );
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-surface">
      {/* Batch 8 (UX audit) — the shared `Checkbox`/`Label` pair, replacing
          a raw `<input type="checkbox">` with no focus-ring/keyboard parity
          with the rest of the app. */}
      {TOGGLES.map((toggle) => (
        <div key={toggle.key} className="flex items-center gap-2">
          <Checkbox
            id={`ai-settings-${toggle.key}`}
            checked={draft[toggle.key]}
            disabled={mutation.isPending}
            onCheckedChange={(checked) => void handleToggle(toggle.key, checked === true)}
          />
          <Label
            htmlFor={`ai-settings-${toggle.key}`}
            className="text-sm font-normal text-ink-strong"
          >
            {t(toggle.labelKey)}
          </Label>
        </div>
      ))}
      {error && <Alert variant="destructive">{error}</Alert>}
    </Card>
  );
}

function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}
