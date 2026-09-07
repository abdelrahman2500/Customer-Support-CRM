/**
 * RM-12 — Locale-Routing Test Coverage. Mirrors `apps/web`'s own identical
 * extraction; see that file's own doc comment for why this is pulled out
 * of `[locale]/layout.tsx` rather than tested there directly.
 */
export function localeDirection(locale: string): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}
