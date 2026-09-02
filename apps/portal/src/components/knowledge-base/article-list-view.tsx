"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const [search, setSearch] = useState("");
  const articlesQuery = usePublishedArticlesQuery(search, locale.toUpperCase() as KbLocale);

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
      <h1 className="text-lg font-semibold text-slate-900">{t("list.title")}</h1>

      <input
        type="text"
        aria-label={t("list.searchLabel")}
        placeholder={t("list.searchPlaceholder")}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="mt-3 w-full max-w-sm rounded-md border border-slate-300 px-3 py-1.5 text-sm shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
      />

      {articlesQuery.isLoading && (
        <div className="mt-3 flex flex-col gap-2">
          {[0, 1, 2].map((row) => (
            <div key={row} className="h-10 w-full animate-pulse rounded-md bg-slate-100" />
          ))}
        </div>
      )}

      {articlesQuery.isError && (
        <div className="mt-3 flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>{t("list.error")}</span>
          <button
            type="button"
            onClick={() => articlesQuery.refetch()}
            className="rounded-md border border-red-300 bg-white px-2 py-1 text-xs font-medium hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            {t("list.retry")}
          </button>
        </div>
      )}

      {articlesQuery.isSuccess && articlesQuery.data.length === 0 && search !== "" && (
        <p className="mt-3 text-sm text-slate-500">{t("list.noResults")}</p>
      )}

      {articlesQuery.isSuccess && articlesQuery.data.length === 0 && search === "" && (
        <p className="mt-3 text-sm text-slate-500">{t("list.empty")}</p>
      )}

      {articlesQuery.isSuccess && articlesQuery.data.length > 0 && (
        <ol className="mt-3 flex flex-col gap-2 text-sm">
          {articlesQuery.data.map((article) => (
            <li
              key={article.id}
              role="button"
              tabIndex={0}
              className="flex cursor-pointer items-center justify-between border-b border-slate-100 pb-2"
              onClick={() => router.push(`/${locale}/knowledge-base/${article.id}`)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  router.push(`/${locale}/knowledge-base/${article.id}`);
                }
              }}
            >
              <span className="font-medium text-slate-800">{article.title}</span>
              <span className="text-slate-500">{article.category ?? t("list.noCategory")}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
