import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { localeDirection } from "./direction";
import enMessages from "../../messages/en.json";
import arMessages from "../../messages/ar.json";

const MESSAGES = { en: enMessages, ar: arMessages } as const;

/** RM-12 — Locale-Routing Test Coverage. Mirrors `apps/web`'s own
 * identical test; see that file's own doc comment for why this harness
 * exists rather than rendering `[locale]/layout.tsx` directly. */
function LocaleProbe({ locale }: { locale: "en" | "ar" }) {
  return (
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
      <Probe locale={locale} />
    </NextIntlClientProvider>
  );
}

function Probe({ locale }: { locale: "en" | "ar" }) {
  const t = useTranslations("home");
  return <div dir={localeDirection(locale)}>{t("signOut")}</div>;
}

describe("a live locale switch", () => {
  it("changes both the rendered text and the reading direction together", () => {
    const { rerender } = render(<LocaleProbe locale="en" />);

    expect(screen.getByText(enMessages.home.signOut)).toHaveAttribute("dir", "ltr");

    rerender(<LocaleProbe locale="ar" />);

    expect(screen.getByText(arMessages.home.signOut)).toHaveAttribute("dir", "rtl");
    expect(screen.queryByText(enMessages.home.signOut)).not.toBeInTheDocument();
  });
});
