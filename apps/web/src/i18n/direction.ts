/**
 * RM-12 — Locale-Routing Test Coverage. Extracted from `[locale]/
 * layout.tsx`'s own inline `dir` computation so it can be asserted
 * directly: that layout is an async Next.js App Router Server Component,
 * which next-intl wires up via the framework's own RSC request-config
 * plumbing — not something a plain Vitest render can reproduce outside
 * the real Next.js pipeline. The logic itself is trivial, so pulling it
 * out costs nothing and makes the one thing RM-12 actually needs covered
 * (a locale switch flips the reading direction) directly testable.
 *
 * `docs/architecture/10-i18n-and-rtl.md` — Arabic is this app's only
 * right-to-left locale; every other value (including any not in
 * `routing.locales`) is left-to-right.
 */
export function localeDirection(locale: string): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}
