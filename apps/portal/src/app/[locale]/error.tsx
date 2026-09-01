"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

/**
 * Story 96 — Navigation & Route Robustness. Mirrors
 * `apps/web/src/app/[locale]/error.tsx` exactly — see that file's doc
 * comment for the full rationale. Uses a plain styled `<button>`, not a
 * shared `ui/` primitive — portal deliberately has no `ui/` directory
 * (Story 52's own convention, reaffirmed by Story 94).
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
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-8">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">{t("errorBoundary.title")}</h1>
        <p className="mt-2 text-sm text-slate-600">{t("errorBoundary.description")}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          {t("errorBoundary.retry")}
        </button>
      </div>
    </main>
  );
}
