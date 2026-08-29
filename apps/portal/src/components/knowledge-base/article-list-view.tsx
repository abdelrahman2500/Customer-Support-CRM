"use client";

import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { usePublishedArticlesQuery } from "@/hooks/use-portal-knowledge-base";

/**
 * Story 54 — Customer Portal — Knowledge Base Browsing. Read-only: no
 * edit/publish controls exist here (that's agent-only, `apps/web`).
 * Mirrors `apps/portal`'s `TicketListView`'s loading/error/empty/populated
 * shape exactly.
 */
export function ArticleListView() {
  const t = useTranslations("knowledgeBase");
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const articlesQuery = usePublishedArticlesQuery();

  return (
    <section className="rounded-md border border-slate-200 bg-white p-6">
      <h1 className="text-lg font-semibold text-slate-900">{t("list.title")}</h1>

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
            className="rounded-md border border-red-300 bg-white px-2 py-1 text-xs font-medium hover:bg-red-50"
          >
            {t("list.retry")}
          </button>
        </div>
      )}

      {articlesQuery.isSuccess && articlesQuery.data.length === 0 && (
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
