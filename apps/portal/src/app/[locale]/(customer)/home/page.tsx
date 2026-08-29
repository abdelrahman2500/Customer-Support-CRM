import { getTranslations } from "next-intl/server";

/**
 * Story 52 — the Customer Portal's first authenticated page, reached only
 * through the real `(customer)/layout.tsx` SSR auth guard. Ticket
 * submission/tracking, Knowledge Base browsing, and CSAT/feedback (all named
 * in docs/architecture/08-supporting-domains.md) are explicit non-goals of
 * this story — separate, future stories build on this authentication
 * foundation.
 */
export default async function PortalHomePage() {
  const t = await getTranslations("home");

  return (
    <div className="rounded-md border border-slate-200 bg-white p-6">
      <p className="max-w-prose text-sm text-slate-600">{t("placeholder")}</p>
    </div>
  );
}
