import Link from "next/link";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { resolveCookieLocale } from "@/i18n/cookie-locale";
import { localeDirection } from "@/i18n/direction";
import { fontVariables } from "@/lib/fonts";
import { Button, ErrorState, ThemeScript } from "@crm/ui";

/**
 * Story 96 — the ROOT not-found boundary.
 *
 * Story 177 corrected what this file is actually for. Story 96's comment said
 * it was "reached only when `[locale]/layout.tsx` itself throws `notFound()`
 * for a genuinely invalid locale segment"; that is **false**. Measured: the
 * middleware prefixes the default locale before an invalid one ever reaches the
 * layout (`/xx/tickets` → 307 → `/en/xx/tickets`), so that path is unreachable.
 * What actually lands here is **every unmatched URL** — `/en/nope`, `/ar/nope`
 * — because Next serves them from `/_not-found`, outside `[locale]`.
 *
 * It still renders its own `<html>`/`<body>`, and must: `app/layout.tsx`
 * deliberately renders no document tags (see its own comment), so this boundary
 * is the only document on this route. Exactly one of each, on every path.
 *
 * Three things Story 177 fixed here, each previously broken in a way no test
 * could see:
 *
 * 1. **Styling.** The page was completely unstyled — the stylesheet link was
 *    never emitted — so its `h1` fell back to 32px/700 regardless of Story
 *    176's `text-title`. The root layout's CSS import is what fixes that.
 * 2. **Locale.** Copy, `lang` and `dir` were hard-coded English/LTR, so an
 *    Arabic visitor hitting a bad URL got an English, left-to-right page. The
 *    locale now comes from `NEXT_LOCALE`, which the middleware already sets on
 *    this very request (see `resolveCookieLocale`).
 * 3. **Typography.** `<body>` carried neither `fontVariables` nor
 *    `font-sans`, so even once styled the page would have used a system font
 *    — worst for Arabic. Both now match `[locale]/layout.tsx`.
 *
 * Copy comes from the existing `common.notFound.*` catalogue entries rather
 * than being duplicated here, via `getTranslations({locale})` — which only
 * resolves correctly because `i18n/request.ts` now honours an explicit locale.
 *
 * Not to be confused with `[locale]/not-found.tsx`, which is a different
 * boundary for a different path — see that file's own comment.
 */
export default async function RootNotFound() {
  const store = await cookies();
  const locale = resolveCookieLocale(store.get("NEXT_LOCALE")?.value);
  const dir = localeDirection(locale);
  const t = await getTranslations({ locale, namespace: "common" });

  return (
    <html lang={locale} dir={dir} className={fontVariables} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="font-sans antialiased">
        <main className="flex min-h-screen items-center justify-center bg-surface-sunk p-8">
          {/* Story 199 (RD-2.5) — the shared ErrorState instead of a hand-rolled card. */}
          <ErrorState
            className="w-full max-w-sm"
            tone="neutral"
            headingLevel={1}
            title={t("notFound.title")}
            description={t("notFound.description")}
            back={
              <Button asChild variant="outline">
                <Link href={`/${locale}/tickets`}>{t("backLinkLabel")}</Link>
              </Button>
            }
          />
        </main>
      </body>
    </html>
  );
}
