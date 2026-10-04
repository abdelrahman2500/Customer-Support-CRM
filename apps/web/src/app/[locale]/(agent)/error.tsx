"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import * as Sentry from "@sentry/nextjs";
import { Button, ErrorState } from "@crm/ui";

/**
 * Story 199 (RD-2.5, recon NAV-05) — the agent workspace's own error
 * boundary. Next renders a segment's `error.tsx` inside that segment's
 * layout, so a render error on any agent page now keeps the header and the
 * navigation (the shell in `(agent)/layout.tsx`) instead of dropping to the
 * full-screen `[locale]/error.tsx` with no way to move on. It renders no
 * `<main>` of its own — the shell's `<main id="main-content">` wraps it.
 *
 * Same reporting as `[locale]/error.tsx`: logged locally and sent to Sentry,
 * never shown raw.
 */
export default function AgentWorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("common");
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? "en";

  useEffect(() => {
    console.error(error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <ErrorState
      className="mx-auto mt-section w-full max-w-md"
      headingLevel={1}
      title={t("errorBoundary.title")}
      description={t("errorBoundary.description")}
      actions={<Button onClick={reset}>{t("errorBoundary.retry")}</Button>}
      back={
        <Button asChild variant="outline">
          <Link href={`/${locale}/tickets`}>{t("backLinkLabel")}</Link>
        </Button>
      }
    />
  );
}
