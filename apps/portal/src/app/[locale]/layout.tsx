import type { ReactNode } from "react";
import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { localeDirection } from "@/i18n/direction";
import { QueryProvider } from "@/components/providers/query-provider";
import { fontVariables } from "@/lib/fonts";
import "../globals.css";
import { ThemeScript, ThemeSync } from "@crm/ui";

/**
 * Story 232 (PR-6.1) — the document title: a page's own name (its
 * `generateMetadata`, see `lib/page-title.ts`) followed by the product
 * name, or the product name alone for a page without one.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common" });
  const appName = t("appName");
  return { title: { template: `%s · ${appName}`, default: appName } };
}

export function generateStaticParams(): Array<{ locale: string }> {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    // Story 177 — unreachable in practice, and kept deliberately as a guard.
    // next-intl's middleware prefixes the default locale before an invalid
    // segment ever reaches this layout (measured: `/xx/tickets` → 307 →
    // `/en/xx/tickets`), so this branch does not fire for a bad locale in a
    // URL. It stays as a type-narrowing invariant and a backstop if the
    // middleware matcher ever stops covering a path.
    notFound();
  }

  // RM-12 — extracted to `@/i18n/direction` so it can be tested directly.
  const dir = localeDirection(locale);

  return (
    // Story S-1 — mirrors apps/web's own locale layout: font variables on
    // <html> so portalled content inherits them, `font-sans` on <body> to
    // resolve the Latin→Arabic fallback chain.
    <html lang={locale} dir={dir} className={fontVariables} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="font-sans antialiased">
        <NextIntlClientProvider>
          {/* Demo hardening — re-applies the saved theme when a locale switch
              replaces <html> (ThemeScript only runs on a full load). */}
          <ThemeSync />
          <QueryProvider>{children}</QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
