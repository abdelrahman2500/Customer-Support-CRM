"use client";

import { useMemo, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { CORE_PREVIEW_PALETTE, deriveBrandTokens } from "@crm/ui";
import type { Rgb } from "@crm/ui";

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

const rgb = (color: Rgb) => `rgb(${color.join(" ")})`;

/**
 * Story 184 (RD-1.7) — shows an admin what their colours will actually do,
 * before saving: a miniature header, primary action, link and status badge,
 * in the light and dark themes side by side, plus a plain-language verdict.
 *
 * It runs the exact derivation the live app uses (`deriveBrandTokens`), so the
 * preview cannot disagree with what ships. Colours are inline because the
 * two themes are rendered at once — the live CSS tokens can only be in one
 * theme at a time; CORE_PREVIEW_PALETTE mirrors them (guarded by a spec).
 * The status badge is there on purpose: it shows that semantic colours are
 * never branch-controlled.
 */
export function BrandPreview({
  primaryColor,
  secondaryColor,
  brandName,
}: {
  primaryColor: string;
  secondaryColor: string;
  brandName: string;
}) {
  const t = useTranslations("branding");
  const tokens = useMemo(
    () =>
      deriveBrandTokens(
        HEX_COLOR_PATTERN.test(primaryColor) ? primaryColor : null,
        HEX_COLOR_PATTERN.test(secondaryColor) ? secondaryColor : null,
      ),
    [primaryColor, secondaryColor],
  );
  const verdict = tokens === null ? "none" : tokens.accent ? "accepted" : tokens.rejected!;

  return (
    <div className="flex flex-col gap-stack">
      <div className="grid grid-cols-1 gap-stack sm:grid-cols-2">
        {(["light", "dark"] as const).map((theme) => {
          const palette = CORE_PREVIEW_PALETTE[theme];
          const accent = tokens?.accent?.[theme] ?? palette.accent;
          const brand = tokens?.brand ?? palette.brand;
          return (
            <figure key={theme} className="flex flex-col gap-tight">
              <figcaption className="text-caption text-ink-muted">
                {t(theme === "light" ? "previewLight" : "previewDark")}
              </figcaption>
              <div
                aria-hidden="true"
                data-testid={`brand-preview-${theme}`}
                className="overflow-hidden rounded-inner border"
                style={{ backgroundColor: rgb(palette.sunk), borderColor: rgb(palette.rule) } as CSSProperties}
              >
                <div
                  className="truncate px-3 py-2 text-body-sm font-semibold"
                  style={{
                    backgroundColor: rgb(palette.surface),
                    color: rgb(palette.ink),
                    borderBottom: `2px solid ${rgb(brand)}`,
                  }}
                >
                  {brandName}
                </div>
                <div className="flex flex-wrap items-center gap-inline p-3 text-body-sm">
                  <span
                    data-testid={`brand-preview-${theme}-button`}
                    className="rounded-control px-3 py-1.5 font-medium"
                    style={{ backgroundColor: rgb(accent.accent), color: rgb(accent.foreground) }}
                  >
                    {t("previewButton")}
                  </span>
                  <span className="underline" style={{ color: rgb(accent.accent) }}>
                    {t("previewLink")}
                  </span>
                  <span
                    className="rounded-pill px-2 py-0.5 text-caption font-medium"
                    style={{ backgroundColor: rgb(palette.infoSurface), color: rgb(palette.infoForeground) }}
                  >
                    {t("previewStatus")}
                  </span>
                </div>
              </div>
            </figure>
          );
        })}
      </div>
      <p role="status" className="text-body-sm text-ink-muted">
        {t(`verdict.${verdict}`)}
      </p>
    </div>
  );
}
