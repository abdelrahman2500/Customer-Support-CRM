import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

/**
 * Story 96 — Navigation & Route Robustness. Mirrors
 * `apps/web/src/app/[locale]/not-found.tsx` exactly — see that file's doc
 * comment for the full rationale. Links back to `/home`, this app's real
 * authenticated landing page, rather than `/tickets`.
 */
export default async function LocaleNotFound() {
  const t = await getTranslations("common");
  const locale = await getLocale();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-8">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">{t("notFound.title")}</h1>
        <p className="mt-2 text-sm text-slate-600">{t("notFound.description")}</p>
        <Link
          href={`/${locale}/home`}
          className="mt-4 inline-block text-sm font-medium text-slate-900 hover:underline"
        >
          {t("backLinkLabel")}
        </Link>
      </div>
    </main>
  );
}
