"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Alert, Button, FetchingIndicator, Input, Pagination, Skeleton } from "@crm/ui";
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
  /** Story S-8c — 1-based; `undefined` until the reader pages. */
  const [page, setPage] = useState<number | undefined>(undefined);

  /** Typing resets to page 1 in the same update as the search term, so no
   * request is ever made for "page 7 of the new search". */
  function updateSearch(value: string) {
    setSearch(value);
    setPage(undefined);
  }

  const articlesQuery = usePublishedArticlesQuery(search, locale.toUpperCase() as KbLocale, page);
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
  const articlePage = articlesQuery.data;
  const articles = articlePage?.items;

  return (
    <section className="rounded-md border border-rule bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-ink">{t("list.title")}</h1>
        {/* In the heading's own row, so it adds no height and cannot shift
            the list below it. */}
        <FetchingIndicator active={articlesQuery.isPlaceholderData} label={tCommon("updating")} />
      </div>

      <Input
        type="text"
        aria-label={t("list.searchLabel")}
        placeholder={t("list.searchPlaceholder")}
        value={search}
        onChange={(event) => updateSearch(event.target.value)}
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
        <Alert variant="destructive" className="mt-3 flex items-center justify-between">
          <span>{t("list.error")}</span>
          <Button variant="outline" size="sm" onClick={() => articlesQuery.refetch()}>
            {t("list.retry")}
          </Button>
        </Alert>
      )}

      {articles !== undefined && articles.length === 0 && search !== "" && (
        <p className="mt-3 text-sm text-ink-subtle">{t("list.noResults")}</p>
      )}

      {articles !== undefined && articles.length === 0 && search === "" && (
        <p className="mt-3 text-sm text-ink-subtle">{t("list.empty")}</p>
      )}

      {articles !== undefined && articles.length > 0 && (
        <ol className="mt-3 flex flex-col gap-2 text-sm">
          {articles.map((article) => (
            <li
              key={article.id}
              className="flex cursor-pointer items-center justify-between gap-2 border-b border-rule-subtle pb-2"
              onClick={() => router.push(`/${locale}/knowledge-base/${article.id}`)}
            >
              {/* `min-w-0 break-words`: an article title is author-written
                  free text, and a flex item's default `min-width: auto`
                  refuses to shrink below it, so a long title pushed the
                  category beside it past the viewport edge (measured: 9px of
                  horizontal page overflow at 390px). The category keeps
                  `shrink-0` so it is never the thing squeezed instead, and
                  the row gains `gap-2` so the two can no longer touch once
                  the title is allowed to fill the space — the same shape as
                  `apps/web`'s own knowledge-base row, which already pairs
                  `justify-between` with a gap. */}
              <Link
                href={`/${locale}/knowledge-base/${article.id}`}
                className="focus-ring min-w-0 break-words rounded-sm font-medium text-ink-strong hover:underline"
                onClick={(event) => event.stopPropagation()}
              >
                {article.title}
              </Link>
              <span className="shrink-0 text-ink-subtle">
                {article.categoryName ?? t("list.noCategory")}
              </span>
            </li>
          ))}
        </ol>
      )}

      {articlePage !== undefined && (
        <div className="mt-3">
          {/* Story S-8c — the shared pager, same primitive the agent
              workspace uses. Renders nothing for a single page, so a small
              published library looks exactly as it did before. */}
          <Pagination
            page={articlePage.page}
            totalPages={articlePage.totalPages}
            onPageChange={setPage}
            disabled={articlesQuery.isPlaceholderData}
            label={tCommon("pagination.label")}
            previousLabel={tCommon("pagination.previous")}
            nextLabel={tCommon("pagination.next")}
            indicator={tCommon("pagination.indicator", {
              page: articlePage.page,
              totalPages: articlePage.totalPages,
            })}
          />
        </div>
      )}
    </section>
  );
}
