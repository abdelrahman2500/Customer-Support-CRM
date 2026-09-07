import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { localeDirection } from "./direction";
import enMessages from "../../messages/en.json";
import arMessages from "../../messages/ar.json";

const MESSAGES = { en: enMessages, ar: arMessages } as const;

/**
 * RM-12 — Locale-Routing Test Coverage. The one end-to-end-flavored test
 * the story asks for: that switching locale actually changes both the
 * rendered text and the reading direction together, not just one or the
 * other in isolation (`routing.spec.ts`/`request.spec.ts`/
 * `direction.spec.ts` each already cover their own piece alone).
 *
 * `[locale]/layout.tsx` itself — the real place `dir` lands on `<html>` —
 * is an async Next.js App Router Server Component whose `NextIntlClientProvider`
 * gets its `locale`/`messages` from the framework's own RSC request-config
 * plumbing (`request.ts`), not from explicit props; that plumbing only
 * exists inside a real Next.js render and can't be reproduced by calling
 * the layout function directly under Vitest/jsdom. This renders a small
 * harness instead: a real `<div dir={localeDirection(locale)}>` (the same
 * pure function the real layout now calls) wrapping real translated text
 * from `useTranslations`, driven by an explicit `locale`/`messages` pair —
 * exactly the `NextIntlClientProvider` usage this codebase already relies
 * on in tests (e.g. `user-list-view.spec.tsx`), just re-rendered under both
 * locales in the same test to prove the two actually change together.
 */
function LocaleProbe({ locale }: { locale: "en" | "ar" }) {
  return (
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
      <Probe locale={locale} />
    </NextIntlClientProvider>
  );
}

function Probe({ locale }: { locale: "en" | "ar" }) {
  const t = useTranslations("workspace");
  return <div dir={localeDirection(locale)}>{t("appName")}</div>;
}

describe("a live locale switch", () => {
  it("changes both the rendered text and the reading direction together", () => {
    const { rerender } = render(<LocaleProbe locale="en" />);

    expect(screen.getByText(enMessages.workspace.appName)).toHaveAttribute("dir", "ltr");

    rerender(<LocaleProbe locale="ar" />);

    expect(screen.getByText(arMessages.workspace.appName)).toHaveAttribute("dir", "rtl");
    expect(screen.queryByText(enMessages.workspace.appName)).not.toBeInTheDocument();
  });
});
