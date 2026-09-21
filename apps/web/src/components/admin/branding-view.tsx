"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useBrandingQuery, useUpdateBrandingMutation } from "@/hooks/use-branding";
import { useErrorMessage } from "@/hooks/use-error-message";
import { resolveNavigationLayout } from "@/components/workspace/nav-items";
import type { BrandingSummary, NavigationLayout } from "@/lib/branding-api";
import { Alert, Button, Card, Input, PageHeader, showSuccessToast, Skeleton } from "@crm/ui";

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

/** Story 129 — matches `UpdateBrandingDto`'s own `@MaxLength(60)`. The name
 * renders inside a fixed-width sidebar rail and a single-line navbar, so
 * the cap is a layout guarantee, not a storage limit. */
const APP_NAME_MAX_LENGTH = 60;

/**
 * Story 62 — Administration — Branch Branding (Foundation). A single-page
 * form + preview, mirroring `AutomationRulesView`'s shape. The preview
 * below the form always reflects the form's own current draft values
 * (never a separately-fetched/rendered surface) — real enough to be
 * useful, zero risk to any shared, already-tested rendering surface
 * elsewhere in either frontend app (Design decision 5 of the plan).
 *
 * Story 129 — the application name and the Agent Workspace's navigation
 * layout join the same form and the same `BrandingConfig` row. No new
 * route, no new tab, no second persistence mechanism: this screen is
 * already the Branding tab of `SettingsView` (RM-23) and is still reachable
 * at `/{locale}/branding`. The existing loading / error / success /
 * forbidden states cover both new fields as they stand.
 */
export function BrandingView() {
  const t = useTranslations("branding");
  const brandingQuery = useBrandingQuery();

  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={t("title")} description={t("description")} />

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

function BrandingForm({ initial }: { initial: BrandingSummary }) {
  const t = useTranslations("branding");
  const errorMessage = useErrorMessage();
  const mutation = useUpdateBrandingMutation();
  const [appName, setAppName] = useState(initial.appName ?? "");
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl ?? "");
  const [primaryColor, setPrimaryColor] = useState(initial.primaryColor ?? "");
  const [secondaryColor, setSecondaryColor] = useState(initial.secondaryColor ?? "");
  // Story 129 — the draft is the *resolved* layout, never `null`: the two
  // radios are a closed set with no "unset" option, and an unconfigured
  // branch is already rendering the navbar, so `NAVBAR` is what the form
  // must show it as. `resolveNavigationLayout` is the same single
  // resolution point the shell uses — this screen does not get its own.
  const [navigationLayout, setNavigationLayout] = useState<NavigationLayout>(
    resolveNavigationLayout(initial.navigationLayout),
  );
  const [error, setError] = useState<string | null>(null);

  // Keep the draft in sync if the server value changes underneath us (e.g.
  // a successful save re-fetches) — mirrors every other edit form's own
  // "re-sync from the authoritative refetch" convention in this codebase.
  useEffect(() => {
    setAppName(initial.appName ?? "");
    setLogoUrl(initial.logoUrl ?? "");
    setPrimaryColor(initial.primaryColor ?? "");
    setSecondaryColor(initial.secondaryColor ?? "");
    setNavigationLayout(resolveNavigationLayout(initial.navigationLayout));
  }, [
    initial.appName,
    initial.logoUrl,
    initial.primaryColor,
    initial.secondaryColor,
    initial.navigationLayout,
  ]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await mutation.mutateAsync({
        ...(appName.trim() ? { appName: appName.trim() } : {}),
        ...(logoUrl.trim() ? { logoUrl: logoUrl.trim() } : {}),
        ...(primaryColor.trim() ? { primaryColor: primaryColor.trim() } : {}),
        ...(secondaryColor.trim() ? { secondaryColor: secondaryColor.trim() } : {}),
        // Always sent, unlike the four text fields above: this is a closed
        // union with no empty-string state to skip, and omitting it would
        // make "switch back to Navbar" a no-op.
        navigationLayout,
      });
      // Every other write surface in this app confirms itself (a toast or a
      // success Alert); without this a successful save looked identical to
      // clicking a dead button.
      showSuccessToast(t("saveSuccess"));
    } catch (submitError) {
      setError(
        errorMessage(submitError, { forbidden: t("saveForbidden"), generic: t("saveFailed") }),
      );
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
  /** Story 129 — the same `?.trim() ||` fallback the workspace header
   * applies, so the preview shows exactly what the header will show,
   * whitespace-only name included. */
  const previewBrandName = appName.trim() || t("previewBrandName");

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card asChild className="flex flex-col gap-3 p-surface">
        <form onSubmit={handleSubmit}>
          {/* The help text sits outside the `<label>`, tied to the input with
            `aria-describedby` instead: inside it, it would become part of
            the field's own accessible name rather than its description. */}
          <div className="flex flex-col gap-1">
            <label className="flex flex-col gap-1 text-xs text-ink-muted">
              {t("appNameLabel")}
              <Input
                value={appName}
                maxLength={APP_NAME_MAX_LENGTH}
                placeholder={t("appNamePlaceholder")}
                aria-describedby="branding-app-name-help"
                onChange={(event) => setAppName(event.target.value)}
              />
            </label>
            <span id="branding-app-name-help" className="text-xs text-ink-subtle">
              {t("appNameHelp")}
            </span>
          </div>
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            {t("logoUrlLabel")}
            <Input
              value={logoUrl}
              placeholder={t("logoUrlPlaceholder")}
              onChange={(event) => setLogoUrl(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            {t("primaryColorLabel")}
            <Input
              value={primaryColor}
              placeholder="#0f172a"
              aria-invalid={invalidPrimary || undefined}
              onChange={(event) => setPrimaryColor(event.target.value)}
            />
            {invalidPrimary && <span className="text-red-600">{t("invalidColor")}</span>}
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            {t("secondaryColorLabel")}
            <Input
              value={secondaryColor}
              placeholder="#64748b"
              aria-invalid={invalidSecondary || undefined}
              onChange={(event) => setSecondaryColor(event.target.value)}
            />
            {invalidSecondary && <span className="text-red-600">{t("invalidColor")}</span>}
          </label>
          {/* Story 129 — native `<input type="radio">`s in a `<fieldset>`
            (the precedent is `automation-rules-view.tsx`). No `RadioGroup`
            primitive exists in `@crm/ui` and two options do not justify
            adding one: a native radio group is already keyboard-accessible
            (arrow keys, one roving tab stop) and needs no JavaScript. */}
          <fieldset className="flex flex-col gap-1">
            <legend className="text-xs text-ink-muted">{t("navigationLayoutLegend")}</legend>
            <span className="text-xs text-ink-subtle">{t("navigationLayoutHelp")}</span>
            <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(["NAVBAR", "SIDEBAR"] as const).map((option) => {
                const checked = navigationLayout === option;
                return (
                  <label
                    key={option}
                    className={`flex cursor-pointer items-start gap-2 rounded-md border p-3 text-xs transition-colors ${
                      checked
                        ? "border-accent bg-accent-surface"
                        : "border-rule hover:bg-surface-muted"
                    }`}
                  >
                    <input
                      type="radio"
                      name="navigationLayout"
                      value={option}
                      checked={checked}
                      className="mt-0.5"
                      onChange={() => setNavigationLayout(option)}
                    />
                    <span className="flex flex-col gap-1.5">
                      <span className="font-medium text-ink-strong">
                        {t(`navigationLayout.${option === "SIDEBAR" ? "sidebar" : "navbar"}`)}
                      </span>
                      <span className="text-ink-subtle">
                        {t(
                          `navigationLayout.${
                            option === "SIDEBAR" ? "sidebarDescription" : "navbarDescription"
                          }`,
                        )}
                      </span>
                      <NavigationLayoutThumbnail layout={option} />
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
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
      </Card>

      <Card className="p-surface">
        <h2 className="text-sm font-semibold text-ink">{t("previewHeading")}</h2>
        <div className="mt-3 flex flex-col gap-3">
          <p className="truncate text-sm font-semibold text-ink-strong">{previewBrandName}</p>
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
              className="h-6 w-6 rounded-full border border-rule-strong"
              style={{ backgroundColor: validPrimary ? primaryColor : undefined }}
              aria-hidden="true"
            />
            <span className="text-ink-muted">{t("primaryColorLabel")}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span
              className="h-6 w-6 rounded-full border border-rule-strong"
              style={{ backgroundColor: validSecondary ? secondaryColor : undefined }}
              aria-hidden="true"
            />
            <span className="text-ink-muted">{t("secondaryColorLabel")}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

/** A static, CSS-only sketch of the arrangement each option produces — a
 * bar across the top versus a rail down the start edge. `aria-hidden`: the
 * option's own name and description above already say what it is, and
 * there is nothing here for a screen reader to read. Logical properties
 * throughout, so the rail sketch mirrors under RTL exactly as the real
 * rail does. */
function NavigationLayoutThumbnail({ layout }: { layout: NavigationLayout }) {
  return (
    <span aria-hidden="true" className="mt-1 flex h-12 w-full rounded border border-rule p-1">
      {layout === "NAVBAR" ? (
        <span className="flex w-full flex-col gap-1">
          <span className="h-2 w-full rounded-sm bg-accent-surface" />
          <span className="flex-1 rounded-sm bg-surface-muted" />
        </span>
      ) : (
        <span className="flex w-full gap-1">
          <span className="w-3 rounded-sm bg-accent-surface" />
          <span className="flex-1 rounded-sm bg-surface-muted" />
        </span>
      )}
    </span>
  );
}
