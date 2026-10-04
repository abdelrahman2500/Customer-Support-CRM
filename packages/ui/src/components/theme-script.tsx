import { THEME_INIT_SCRIPT } from "../lib/theme";

/**
 * Story 181 (RD-1.4) — render inside `<head>` of every root `<html>` so an
 * explicit light/dark choice is applied before first paint. Pair it with
 * `suppressHydrationWarning` on `<html>`, whose `data-theme` the script sets
 * after the server rendered it. See `../lib/theme.ts`.
 */
export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />;
}
