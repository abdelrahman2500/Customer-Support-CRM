"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FetchingIndicator, Input, Skeleton } from "@crm/ui";
import { usePublishedArticlesQuery } from "@/hooks/use-portal-knowledge-base";
import type { KbLocale } from "@/lib/knowledge-base-api";

/**
 * Story 54 — Customer Portal — Knowledge Base Browsing. Read-only: no
 * edit/publish controls exist here (that's agent-only, `apps/web`).
 * Mirrors `apps/portal`'s `TicketListView`'s loading/error/empty/populated
 * shape exactly.
 *
 * Story 64 — a plain, un-debounced search input above the list, mirroring
 * `apps/web`'s own `ArticleListView` addition; local `useState`, wired
 * straight into `usePublishedArticlesQuery(search)`.
 *
 * Story 109 — the active `next-intl` locale (`en`/`ar`, already
 * destructured off `useParams()` for navigation, previously unused for
 * this) is uppercased to `KbLocale`'s own `EN`/`AR` values and passed
 * through, so a visitor sees an article's Arabic content whenever an
 * agent has set it — falling back to the base (English) content
 * otherwise, resolved server-side.
 */
export function ArticleListView() {
  const t = useTranslations("knowledgeBase");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const [search, setSearch] = useState("");
  const articlesQuery = usePublishedArticlesQuery(search, locale.toUpperCase() as KbLocale);
  /**
   * Story S-7 — the articles to render whatever their provenance: a
   * completed fetch, the previous search kept as placeholder data, or the
   * last success still standing behind a failed refetch.
   *
   * This screen keeps its own error/empty markup rather than adopting
   * `QueryStateCard`. Its empty state is a quiet inline sentence inside a
   * card (`mt-3 text-sm`) and its error is a compact red strip, neither of
   * which `EmptyState`'s dashed `p-8` block or `Alert`'s full-width panel
   * would reproduce — adopting them here would redesign the screen rather
   * than de-duplicate it, which this story is not for. The S-7 *semantics*
   * are all here regardless: pending-vs-placeholder, a fetch indicator, and
   * an error that no longer takes the rows down with it.
   */
  const articles = articlesQuery.data;

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900">{t("list.title")}</h1>
        {/* In the heading's own row, so it adds no height and cannot shift
            the list below it. */}
        <FetchingIndicator active={articlesQuery.isPlaceholderData} label={tCommon("updating")} />
      </div>

      <Input
        type="text"
        aria-label={t("list.searchLabel")}
        placeholder={t("list.searchPlaceholder")}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="mt-3 max-w-sm"
      />

      {articlesQuery.isPending && (
        <div className="mt-3 flex flex-col gap-2">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-10 w-full" />
          ))}
        </div>
      )}

      {articlesQuery.isError && (
        <div className="mt-3 flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>{t("list.error")}</span>
          <button
            type="button"
            onClick={() => articlesQuery.refetch()}
            className="rounded-md border border-red-300 bg-white px-2 py-1 text-xs font-medium hover:bg-red-50 focus-ring"
          >
            {t("list.retry")}
          </button>
        </div>
      )}

      {articles !== undefined && articles.length === 0 && search !== "" && (
        <p className="mt-3 text-sm text-slate-500">{t("list.noResults")}</p>
      )}

      {articles !== undefined && articles.length === 0 && search === "" && (
        <p className="mt-3 text-sm text-slate-500">{t("list.empty")}</p>
      )}

      {articles !== undefined && articles.length > 0 && (
        <ol className="mt-3 flex flex-col gap-2 text-sm">
          {articles.map((article) => (
            <li
              key={article.id}
              className="flex cursor-pointer items-center justify-between border-b border-slate-100 pb-2"
              onClick={() => router.push(`/${locale}/knowledge-base/${article.id}`)}
            >
              <Link
                href={`/${locale}/knowledge-base/${article.id}`}
                className="focus-ring rounded-sm font-medium text-slate-800 hover:underline"
                onClick={(event) => event.stopPropagation()}
              >
                {article.title}
              </Link>
              <span className="text-slate-500">{article.category ?? t("list.noCategory")}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
