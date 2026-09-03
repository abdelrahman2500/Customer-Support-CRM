import type { ReactNode } from "react";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { QueryProvider } from "@/components/providers/query-provider";
import { fontVariables } from "@/lib/fonts";
import "../globals.css";

// This is the app's root layout (there is no sibling `app/layout.tsx`):
// `dir` depends on the active locale, so it must be set on the <html> tag
// inside the [locale] segment, which is where the locale param is available.
// See docs/architecture/10-i18n-and-rtl.md.

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
    // Story S-1 — the font variables go on <html> so they are in scope for
    // portalled content too (Radix renders the select and dialog into
    // document.body, outside this tree). `font-sans` on <body> is what
    // actually resolves them, via tailwind.config.ts's Latin→Arabic chain.
    <html lang={locale} dir={dir} className={fontVariables}>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <NextIntlClientProvider>
          <QueryProvider>{children}</QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
