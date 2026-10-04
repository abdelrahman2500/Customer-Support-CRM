"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import * as Sentry from "@sentry/nextjs";
import { Button, ErrorState } from "@crm/ui";

/**
 * Story 96 — Navigation & Route Robustness. Mirrors
 * `apps/web/src/app/[locale]/error.tsx` exactly — see that file's doc
 * comment for the full rationale. Uses a plain styled `<button>`, not a
 * shared `ui/` primitive — portal deliberately has no `ui/` directory
 * (Story 52's own convention, reaffirmed by Story 94).
 *
 * Story 113 — `Sentry.captureException` reports it (a no-op when
 * `NEXT_PUBLIC_SENTRY_DSN` is unset) — see `apps/web`'s own equivalent
 * doc comment.
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
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-sunk p-8">
      {/* Story 199 (RD-2.5) — the shared ErrorState instead of a hand-rolled card. */}
      <ErrorState
        className="w-full max-w-sm"
        headingLevel={1}
        title={t("errorBoundary.title")}
        description={t("errorBoundary.description")}
        actions={<Button onClick={reset}>{t("errorBoundary.retry")}</Button>}
      />
    </main>
  );
}
