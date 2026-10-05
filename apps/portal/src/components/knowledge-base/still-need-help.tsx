"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AddIcon, AiSummaryIcon, Card } from "@crm/ui";

/**
 * Story 231 (PR-5.3) — where a help article ends, the two ways on: ask the
 * assistant, or raise a ticket. Shown under the article list and under
 * every article, so a customer who did not find their answer is never at a
 * dead end.
 */
export function StillNeedHelp() {
  const t = useTranslations("knowledgeBase");
  const { locale } = useParams<{ locale: string }>();
  const linkClassName =
    "focus-ring inline-flex items-center gap-2 rounded-control border border-rule bg-surface px-3 py-2 text-sm font-medium text-ink hover:border-rule-strong hover:bg-surface-muted";

  return (
    <Card
      asChild
      className="flex flex-col gap-3 bg-accent-surface p-surface sm:flex-row sm:items-center"
    >
      <aside aria-labelledby="still-need-help">
        <div className="flex min-w-0 flex-1 flex-col gap-tight">
          <h2 id="still-need-help" className="font-semibold text-ink">
            {t("help.heading")}
          </h2>
          <p className="text-sm text-ink-muted">{t("help.body")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/${locale}/chat`} className={linkClassName}>
            <AiSummaryIcon aria-hidden="true" className="size-4 text-accent" />
            {t("help.askAssistant")}
          </Link>
          <Link href={`/${locale}/tickets#new-ticket`} className={linkClassName}>
            <AddIcon aria-hidden="true" className="size-4 text-accent" />
            {t("help.raiseTicket")}
          </Link>
        </div>
      </aside>
    </Card>
  );
}
