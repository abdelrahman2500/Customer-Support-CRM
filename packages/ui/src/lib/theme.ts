/**
 * Story 181 (RD-1.4) — light / dark / system theme preference.
 *
 * The tokens do all the work (packages/config/tailwind-tokens.css): the
 * dark values apply under `:root[data-theme="dark"]`, or under
 * `prefers-color-scheme: dark` unless `data-theme="light"` opts out. So:
 *
 *   - "system" needs no attribute and no script — the CSS media query decides,
 *     and a first paint can never flash;
 *   - an explicit "light"/"dark" lives in the `crm-theme` cookie and is put on
 *     `<html>` before paint by `THEME_INIT_SCRIPT` (rendered by `ThemeScript`
 *     in each app's `<head>`). A blocking inline script — not a server read of
 *     the cookie — keeps the `[locale]` layouts statically renderable.
 *
 * A cookie rather than a user-profile field: per-user persistence would need a
 * schema change, which the redesign deliberately excludes (00-overview §12 D5).
 */
export const THEME_COOKIE = "crm-theme";
export const THEME_PREFERENCES = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && (THEME_PREFERENCES as readonly string[]).includes(value);
}

/** Reads the preference from a `document.cookie`-style string. */
export function readThemePreference(cookieHeader: string | undefined | null): ThemePreference {
  const match = new RegExp(`(?:^|;\\s*)${THEME_COOKIE}=([^;]*)`).exec(cookieHeader ?? "");
  const value = match ? decodeURIComponent(match[1]!) : undefined;
  return isThemePreference(value) ? value : "system";
}

/**
 * Inline, render-blocking, dependency-free: runs before first paint. Only an
 * explicit light/dark is applied; anything else leaves the media query in
 * charge. Wrapped in try/catch so a locked-down cookie jar cannot break the page.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|;\\s*)${THEME_COOKIE}=(light|dark)(?:;|$)/);if(m){document.documentElement.setAttribute("data-theme",m[1]);}}catch(e){}})();`;

/** Client-side: persist the preference and apply it without a reload. */
export function applyThemePreference(preference: ThemePreference): void {
  if (typeof document === "undefined") {
    return;
  }
  document.cookie = `${THEME_COOKIE}=${preference}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
  if (preference === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", preference);
  }
}
