import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

/**
 * Story 96 — the LOCALISED not-found boundary.
 *
 * Story 177 corrected what this file covers. Story 96 described it as handling
 * "the common case: a valid locale with no matching route, e.g.
 * `/en/does-not-exist`" — that is **not** what happens. Unmatched URLs are
 * served by Next from `/_not-found`, which sits outside `[locale]`, so they
 * reach `app/not-found.tsx` instead and never arrive here. Measured directly.
 *
 * What genuinely reaches this boundary is a **descendant `notFound()`** — a
 * page or layout inside `[locale]` calling it explicitly. That was verified by
 * experiment: a component inside the segment calling `notFound()` renders this
 * file, correctly localised, nested in `[locale]/layout.tsx`. So this is live
 * code for that path, not dead code, even though nothing in either app calls
 * `notFound()` today.
 *
 * It renders no document tags on purpose: `[locale]/layout.tsx` above it owns
 * the single `<html>`/`<body>`.
 *
 * **Known limitation, deliberately not fixed here.** A `notFound()` raised
 * inside `[locale]` renders this UI with an HTTP **200**, not 404: the async
 * `[locale]/layout.tsx` has already begun streaming by the time the descendant
 * throws, so the status can no longer be changed. A real 404 status can only
 * come from Next's own `/_not-found` route. That is precisely why unmatched
 * URLs are handled by the root boundary rather than being routed through here.
 */
export default async function LocaleNotFound() {
  const t = await getTranslations("common");
  const locale = await getLocale();

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-sunk p-8">
      <div className="w-full max-w-sm rounded-lg border border-rule bg-surface p-8 text-center shadow-sm">
        <h1 className="text-title text-ink">{t("notFound.title")}</h1>
        <p className="mt-2 text-sm text-ink-muted">{t("notFound.description")}</p>
        <Link
          href={`/${locale}/home`}
          className="mt-4 inline-block text-sm font-medium text-ink hover:underline"
        >
          {t("backLinkLabel")}
        </Link>
      </div>
    </main>
  );
}
