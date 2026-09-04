"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useBrandingQuery, useUpdateBrandingMutation } from "@/hooks/use-branding";
import { ApiError } from "@/lib/api";
import { Alert, Button, Input, showSuccessToast, Skeleton } from "@crm/ui";

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

/**
 * Story 62 — Administration — Branch Branding (Foundation). A single-page
 * form + preview, mirroring `AutomationRulesView`'s shape. The preview
 * below the form always reflects the form's own current draft values
 * (never a separately-fetched/rendered surface) — real enough to be
 * useful, zero risk to any shared, already-tested rendering surface
 * elsewhere in either frontend app (Design decision 5 of the plan).
 */
export function BrandingView() {
  const t = useTranslations("branding");
  const brandingQuery = useBrandingQuery();

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-slate-900">{t("title")}</h1>
      <p className="text-sm text-slate-500">{t("description")}</p>

      {brandingQuery.isLoading && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-10 w-full" />
          ))}
        </div>
      )}

      {brandingQuery.isError && (
        <Alert variant="destructive" className="flex items-center justify-between">
          <span>{t("error")}</span>
          <Button variant="outline" size="sm" onClick={() => brandingQuery.refetch()}>
            {t("retry")}
          </Button>
        </Alert>
      )}

      {brandingQuery.isSuccess && <BrandingForm initial={brandingQuery.data} />}
    </section>
  );
}

function BrandingForm({
  initial,
}: {
  initial: { logoUrl: string | null; primaryColor: string | null; secondaryColor: string | null };
}) {
  const t = useTranslations("branding");
  const mutation = useUpdateBrandingMutation();
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl ?? "");
  const [primaryColor, setPrimaryColor] = useState(initial.primaryColor ?? "");
  const [secondaryColor, setSecondaryColor] = useState(initial.secondaryColor ?? "");
  const [error, setError] = useState<string | null>(null);

  // Keep the draft in sync if the server value changes underneath us (e.g.
  // a successful save re-fetches) — mirrors every other edit form's own
  // "re-sync from the authoritative refetch" convention in this codebase.
  useEffect(() => {
    setLogoUrl(initial.logoUrl ?? "");
    setPrimaryColor(initial.primaryColor ?? "");
    setSecondaryColor(initial.secondaryColor ?? "");
  }, [initial.logoUrl, initial.primaryColor, initial.secondaryColor]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await mutation.mutateAsync({
        ...(logoUrl.trim() ? { logoUrl: logoUrl.trim() } : {}),
        ...(primaryColor.trim() ? { primaryColor: primaryColor.trim() } : {}),
        ...(secondaryColor.trim() ? { secondaryColor: secondaryColor.trim() } : {}),
      });
      // Every other write surface in this app confirms itself (a toast or a
      // success Alert); without this a successful save looked identical to
      // clicking a dead button.
      showSuccessToast(t("saveSuccess"));
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : t("saveFailed"));
    }
  }

  const validPrimary = HEX_COLOR_PATTERN.test(primaryColor);
  const validSecondary = HEX_COLOR_PATTERN.test(secondaryColor);
  // Both colors are optional, so "empty" is valid — only a non-empty value
  // that isn't a hex color is a validation failure. Previously `validPrimary`/
  // `validSecondary` were computed but only ever used to tint the preview
  // swatch, so malformed input submitted happily and failed server-side.
  const invalidPrimary = primaryColor.trim() !== "" && !validPrimary;
  const invalidSecondary = secondaryColor.trim() !== "" && !validSecondary;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <form
        className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-4"
        onSubmit={handleSubmit}
      >
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          {t("logoUrlLabel")}
          <Input
            value={logoUrl}
            placeholder={t("logoUrlPlaceholder")}
            onChange={(event) => setLogoUrl(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          {t("primaryColorLabel")}
          <Input
            value={primaryColor}
            placeholder="#0f172a"
            aria-invalid={invalidPrimary || undefined}
            onChange={(event) => setPrimaryColor(event.target.value)}
          />
          {invalidPrimary && <span className="text-red-600">{t("invalidColor")}</span>}
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          {t("secondaryColorLabel")}
          <Input
            value={secondaryColor}
            placeholder="#64748b"
            aria-invalid={invalidSecondary || undefined}
            onChange={(event) => setSecondaryColor(event.target.value)}
          />
          {invalidSecondary && <span className="text-red-600">{t("invalidColor")}</span>}
        </label>
        <div>
          <Button
            type="submit"
            size="sm"
            disabled={mutation.isPending || invalidPrimary || invalidSecondary}
          >
            {mutation.isPending ? t("saving") : t("save")}
          </Button>
        </div>
        {error && <Alert variant="destructive">{error}</Alert>}
      </form>

      <div className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">{t("previewHeading")}</h2>
        <div className="mt-3 flex flex-col gap-3">
          {logoUrl.trim() ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={t("logoPreviewAlt")}
              className="h-12 w-auto max-w-full object-contain"
            />
          ) : (
            <p className="text-sm text-ink-subtle">{t("noLogo")}</p>
          )}
          <div className="flex items-center gap-2 text-sm">
            <span
              className="h-6 w-6 rounded-full border border-slate-300"
              style={{ backgroundColor: validPrimary ? primaryColor : undefined }}
              aria-hidden="true"
            />
            <span className="text-slate-600">{t("primaryColorLabel")}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span
              className="h-6 w-6 rounded-full border border-slate-300"
              style={{ backgroundColor: validSecondary ? secondaryColor : undefined }}
              aria-hidden="true"
            />
            <span className="text-slate-600">{t("secondaryColorLabel")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
