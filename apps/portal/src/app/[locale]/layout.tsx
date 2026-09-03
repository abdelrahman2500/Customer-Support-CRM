import type { ReactNode } from "react";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { QueryProvider } from "@/components/providers/query-provider";
import { fontVariables } from "@/lib/fonts";
import "../globals.css";

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
    notFound();
  }

  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    // Story S-1 — mirrors apps/web's own locale layout: font variables on
    // <html> so portalled content inherits them, `font-sans` on <body> to
    // resolve the Latin→Arabic fallback chain.
    <html lang={locale} dir={dir} className={fontVariables}>
      <body className="font-sans antialiased">
        <NextIntlClientProvider>
          <QueryProvider>{children}</QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
