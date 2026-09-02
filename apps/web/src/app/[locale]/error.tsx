"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";

/**
 * Story 96 — Navigation & Route Robustness. A minimal safety net for an
 * unexpected render-time exception anywhere within a route segment (e.g. a
 * bug in a view component) — previously nothing in this tree caught this,
 * so it fell through to Next's default, unbranded error overlay. Must be a
 * Client Component per the App Router's own `error.tsx` contract.
 *
 * Not a replacement for each screen's own existing query/mutation error
 * states (Story 94's error-classification helpers) — this is a last-resort
 * reset boundary for a genuine render-time throw, not the everyday
 * "the API returned a 4xx/5xx" case those already handle.
 *
 * Story 113 — `Sentry.captureException` reports it (a no-op when
 * `NEXT_PUBLIC_SENTRY_DSN` is unset, see `instrumentation-client.ts`),
 * closing the gap this file's own doc comment used to note explicitly
 * ("no analytics/reporting pipeline exists in this repository").
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("common");

  useEffect(() => {
    // Logged for local diagnosis either way.
    console.error(error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-8">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">{t("errorBoundary.title")}</h1>
        <p className="mt-2 text-sm text-slate-600">{t("errorBoundary.description")}</p>
        <Button onClick={reset} className="mt-4">
          {t("errorBoundary.retry")}
        </Button>
      </div>
    </main>
  );
}
