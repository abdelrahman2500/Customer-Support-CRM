import { getLocale, getTranslations } from "next-intl/server";

/**
 * Story 52 — the Customer Portal's first authenticated page, reached only
 * through the real `(customer)/layout.tsx` SSR auth guard.
 *
 * Story 53 — gains a link into the new "My Tickets" screen. Knowledge Base
 * browsing and CSAT/feedback (also named in
 * docs/architecture/08-supporting-domains.md) remain separate, future
 * stories' concern.
 */
export default async function PortalHomePage() {
  const t = await getTranslations("home");
  const locale = await getLocale();

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <p className="max-w-prose text-sm text-slate-600">{t("placeholder")}</p>
      <a
        href={`/${locale}/tickets`}
        className="mt-3 inline-block text-sm font-medium text-slate-900 hover:underline"
      >
        {t("myTicketsLink")}
      </a>
    </div>
  );
}
