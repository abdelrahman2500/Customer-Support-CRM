"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, LoadingStatus, PageHeader, Skeleton } from "@crm/ui";
import { BackLink } from "@crm/ui";
import { StillNeedHelp } from "./still-need-help";
import { Button, ErrorState } from "@crm/ui";
import { usePublishedArticleQuery } from "@/hooks/use-portal-knowledge-base";
import { ApiError } from "@/lib/api";
import type { KbLocale } from "@/lib/knowledge-base-api";

/** Batch 2 (UX audit) — extracted so `loading.tsx` (the App Router route
 * segment shown during the RSC/bundle fetch, before this component has even
 * mounted) can render the identical shape, mirroring
 * `TicketDetailSkeleton`'s own precedent exactly. */
export function ArticleDetailSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
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
  const tCommon = useTranslations("common");
  const { locale } = useParams<{ locale: string }>();
  const articleQuery = usePublishedArticleQuery(articleId, locale.toUpperCase() as KbLocale);

  if (articleQuery.isLoading) {
    return (
      <LoadingStatus label={tCommon("loading")} placeholderHidden={false}>
        <ArticleDetailSkeleton />
      </LoadingStatus>
    );
  }

  if (articleQuery.isError) {
    const notFound = articleQuery.error instanceof ApiError && articleQuery.error.status === 404;
    // Story 199 (RD-2.5, recon A11Y-03/VL-08) — a record that failed to load
    // is the page: an h1, a way back, and a retry when retrying can help (a
    // 404 will not come back on its own).
    return (
      <ErrorState
        headingLevel={1}
        tone={notFound ? "neutral" : "danger"}
        title={notFound ? t("detail.notFound") : t("detail.loadError")}
        actions={
          notFound ? undefined : (
            <Button onClick={() => void articleQuery.refetch()}>
              {tCommon("errorBoundary.retry")}
            </Button>
          )
        }
        back={
          <BackLink asChild>
            <Link href={`/${locale}/knowledge-base`}>{t("detail.backToList")}</Link>
          </BackLink>
        }
      />
    );
  }

  const article = articleQuery.data;
  if (!article) {
    return null;
  }

  // Story 231 (PR-5.3) — a reading layout: one prose-width column, the
  // category above the title, body copy at reading size and line height,
  // and "Still need help?" where the article ends.
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-section">
      {/* Story 189 — the shared BackLink: chevron flips in RTL, token focus ring. */}
      <BackLink asChild>
        <Link href={`/${locale}/knowledge-base`}>{t("detail.backToList")}</Link>
      </BackLink>

      <Card asChild className="p-surface sm:p-8">
        <article>
          {article.categoryName && (
            <p className="mb-2 text-caption font-medium text-accent">{article.categoryName}</p>
          )}
          <PageHeader title={article.title} />
          <div className="mt-4 whitespace-pre-wrap text-body-lg text-ink-strong">
            {article.body}
          </div>
        </article>
      </Card>

      <StillNeedHelp />
    </section>
  );
}
