import { getLocale, getTranslations } from "next-intl/server";

/**
 * Story 96 — Navigation & Route Robustness.
 *
 * Handles the common case: a valid locale (`[locale]/layout.tsx` already
 * rendered successfully, so this is nested inside its `<html>`/`<body>`/
 * `NextIntlClientProvider` — no document tags needed here) with no matching
 * route, e.g. `/en/does-not-exist`. `getTranslations` resolves via the
 * ambient request locale exactly like every other server component in this
 * tree. See `apps/web/src/app/not-found.tsx` for the separate root boundary
 * that handles a genuinely invalid locale segment.
 */
export default async function LocaleNotFound() {
  const t = await getTranslations("common");
  const locale = await getLocale();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-8">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">{t("notFound.title")}</h1>
        <p className="mt-2 text-sm text-slate-600">{t("notFound.description")}</p>
        <a
          href={`/${locale}/tickets`}
          className="mt-4 inline-block text-sm font-medium text-slate-900 hover:underline"
        >
          {t("backLinkLabel")}
        </a>
      </div>
    </main>
  );
}
