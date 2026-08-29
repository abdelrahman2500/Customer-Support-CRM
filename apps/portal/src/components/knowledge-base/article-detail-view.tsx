"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { usePublishedArticleQuery } from "@/hooks/use-portal-knowledge-base";
import { ApiError } from "@/lib/api";

/** Story 54 — read-only article detail; mirrors `TicketDetailView`'s
 * loading/not-found/generic-error convention. */
export function ArticleDetailView({ articleId }: { articleId: string }) {
  const t = useTranslations("knowledgeBase");
  const { locale } = useParams<{ locale: string }>();
  const articleQuery = usePublishedArticleQuery(articleId);

  if (articleQuery.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <div className="h-8 w-1/2 animate-pulse rounded-md bg-slate-100" />
        <div className="h-32 w-full animate-pulse rounded-md bg-slate-100" />
      </div>
    );
  }

  if (articleQuery.isError) {
    const notFound = articleQuery.error instanceof ApiError && articleQuery.error.status === 404;
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {notFound ? t("detail.notFound") : t("detail.loadError")}
      </div>
    );
  }

  const article = articleQuery.data;
  if (!article) {
    return null;
  }

  return (
    <section className="flex flex-col gap-6">
      <a
        href={`/${locale}/knowledge-base`}
        className="text-sm font-medium text-slate-600 hover:text-slate-900 hover:underline"
      >
        &larr; {t("detail.backToList")}
      </a>

      <div className="rounded-md border border-slate-200 bg-white p-6">
        <h1 className="text-lg font-semibold text-slate-900">{article.title}</h1>
        {article.category && (
          <p className="mt-1 text-xs text-slate-500">{article.category}</p>
        )}
        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{article.body}</p>
      </div>
    </section>
  );
}
