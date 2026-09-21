"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Alert, Card, PageHeader, Skeleton } from "@crm/ui";
import { usePublishedArticleQuery } from "@/hooks/use-portal-knowledge-base";
import { ApiError } from "@/lib/api";
import type { KbLocale } from "@/lib/knowledge-base-api";

/** Batch 2 (UX audit) — extracted so `loading.tsx` (the App Router route
 * segment shown during the RSC/bundle fetch, before this component has even
 * mounted) can render the identical shape, mirroring
 * `TicketDetailSkeleton`'s own precedent exactly. */
export function ArticleDetailSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

/** Story 54 — read-only article detail; mirrors `TicketDetailView`'s
 * loading/not-found/generic-error convention.
 *
 * Story 109 — see `ArticleListView`'s own doc comment: the active locale
 * is passed through the same way. */
export function ArticleDetailView({ articleId }: { articleId: string }) {
  const t = useTranslations("knowledgeBase");
  const { locale } = useParams<{ locale: string }>();
  const articleQuery = usePublishedArticleQuery(articleId, locale.toUpperCase() as KbLocale);

  if (articleQuery.isLoading) {
    return <ArticleDetailSkeleton />;
  }

  if (articleQuery.isError) {
    const notFound = articleQuery.error instanceof ApiError && articleQuery.error.status === 404;
    return (
      <Alert variant="destructive">{notFound ? t("detail.notFound") : t("detail.loadError")}</Alert>
    );
  }

  const article = articleQuery.data;
  if (!article) {
    return null;
  }

  return (
    <section className="flex flex-col gap-6">
      <Link
        href={`/${locale}/knowledge-base`}
        className="text-sm font-medium text-ink-muted hover:text-ink hover:underline"
      >
        {/* `rtl:rotate-180` so "back" points the way back in both
            directions — a bare `&larr;` points *forward* in Arabic.
            `aria-hidden`: the adjacent label already names the action. */}
        <span aria-hidden="true" className="inline-block rtl:rotate-180">
          &larr;
        </span>{" "}
        {t("detail.backToList")}
      </Link>

      <Card className="p-surface">
        <PageHeader title={article.title} />
        {article.categoryName && (
          <p className="mt-1 text-xs text-ink-subtle">{article.categoryName}</p>
        )}
        <p className="mt-3 whitespace-pre-wrap text-sm text-ink-strong">{article.body}</p>
      </Card>
    </section>
  );
}
