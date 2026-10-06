import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

/**
 * Story 232 (PR-6.1) — every page names itself in the browser tab and to
 * assistive technology, which announces the document title on navigation
 * (WCAG 2.4.2; the axe scan found no `<title>` on any route). A page exports
 *
 *     export const generateMetadata = pageTitle("workspace.nav", "tickets");
 *
 * and `[locale]/layout.tsx`'s title template appends the product name:
 * "Tickets · Customer Support CRM". The label is the page's own navigation
 * label, so the tab, the nav and the heading use one vocabulary.
 */
export function pageTitle(namespace: string, key: string) {
  return async function generateMetadata({
    params,
  }: {
    params: Promise<{ locale: string }>;
  }): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace });
    return { title: t(key) };
  };
}
