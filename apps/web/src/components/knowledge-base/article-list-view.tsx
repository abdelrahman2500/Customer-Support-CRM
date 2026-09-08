"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useArticlesQuery, useUpdateArticleMutation } from "@/hooks/use-knowledge-base";
import { useKbCategoriesQuery } from "@/hooks/use-kb-categories";
import type { ArticleSummary } from "@/lib/knowledge-base-api";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useUrlFilters } from "@/lib/url-filters";
import {
  Badge,
  Button,
  FetchingIndicator,
  Input,
  Pagination,
  QueryStateCard,
  Skeleton,
} from "@crm/ui";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@crm/ui";

const ALL_CATEGORIES = "__all__";

/** Batch 4 (UX audit) — the URL <-> this view's own filter shape. Kept
 * local (not `ArticleFilters`, the backend's wider DTO type) since this
 * view only ever drives three of its fields. */
interface ArticleListFilters {
  search: string;
  categoryId?: string;
  page?: number;
}

function parseArticleListFilters(params: URLSearchParams): ArticleListFilters {
  const page = params.get("page");
  return {
    search: params.get("search") ?? "",
    ...(params.get("categoryId") ? { categoryId: params.get("categoryId")! } : {}),
    ...(page ? { page: Number(page) } : {}),
  };
}

function serializeArticleListFilters(filters: ArticleListFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.categoryId) params.set("categoryId", filters.categoryId);
  if (filters.page) params.set("page", String(filters.page));
  return params;
}

/**
 * Story 51 — Knowledge Base article list, over the new `GET
 * /knowledge-base/articles`. Mirrors `SlaPolicyListView`'s exact
 * loading/error/empty/populated conventions.
 *
 * Story 64 — a plain, un-debounced search input above the list (plan
 * Non-Goal explicitly defers debouncing/highlighting/snippets); local
 * `useState`, wired straight into `useArticlesQuery(search)`.
 *
 * Batch 4 (UX audit) — gains a category filter (`useKbCategoriesQuery`,
 * mirroring `TicketListView`'s own category `Select` exactly — the backend
 * `categoryId` filter, RM-27, already existed with no caller on this list).
 * Filters/search/page now live in the URL via `useUrlFilters`, so
 * `ArticleListView` is now a thin `Suspense` wrapper (see
 * `TicketListView`'s own doc comment for the full rationale) around
 * `ArticleListViewContent`.
 */
export function ArticleListView() {
  return (
    <Suspense fallback={null}>
      <ArticleListViewContent />
    </Suspense>
  );
}

function ArticleListViewContent() {
  const t = useTranslations("knowledgeBase");
  const tCommon = useTranslations("common");
  const { locale } = useParams<{ locale: string }>();
  const categoriesQuery = useKbCategoriesQuery();

  const [filters, setFilters] = useUrlFilters(parseArticleListFilters, serializeArticleListFilters);
  const { search, categoryId, page } = filters;

  /**
   * A filter/search change resets to page 1 in the SAME state update.
   * Doing it in a separate effect would first fire a request for "page 7 of
   * the new filter" and only then correct itself - a wasted round trip that
   * also flashes the wrong rows.
   */
  function updateSearch(value: string) {
    setFilters((current) => ({ ...current, search: value, page: undefined }));
  }

  function updateCategory(value: string) {
    setFilters((current) => ({
      ...current,
      categoryId: value === ALL_CATEGORIES ? undefined : value,
      page: undefined,
    }));
  }

  const articlesQuery = useArticlesQuery(search, page, categoryId);
  const articlePage = articlesQuery.data;
  const articles = articlePage?.items;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-slate-900">{t("list.title")}</h1>
          {/* Story S-7 — this list's search is un-debounced, so every
              keystroke was previously a new query key and a full skeleton
              swap. Now the previous results stay and this is the signal. */}
          <FetchingIndicator active={articlesQuery.isPlaceholderData} label={tCommon("updating")} />
        </div>
        <Button size="sm" asChild>
          <Link href={`/${locale}/knowledge-base/new`}>{t("list.createButton")}</Link>
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Input
          aria-label={t("list.searchLabel")}
          placeholder={t("list.searchPlaceholder")}
          value={search}
          onChange={(event) => updateSearch(event.target.value)}
          className="max-w-sm"
        />
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          {t("list.filterCategory")}
          <Select value={categoryId ?? ALL_CATEGORIES} onValueChange={updateCategory}>
            <SelectTrigger
              className="w-full sm:w-auto sm:min-w-[10rem]"
              aria-label={t("list.filterCategory")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CATEGORIES}>{t("list.filterCategoryAll")}</SelectItem>
              {(categoriesQuery.data ?? []).map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>

      {/* Story S-7 — the two dashed blocks this replaces differed only in
          copy and CTA, and were selected by `search !== ""`. That is
          precisely `isFiltered`/`noResults`, so the duplication goes away
          rather than being carried forward. */}
      <QueryStateCard
        isLoading={articlesQuery.isPending}
        isError={articlesQuery.isError && articles === undefined}
        isEmpty={articles !== undefined && articles.length === 0}
        isFiltered={search !== ""}
        loadingLabel={tCommon("loading")}
        loadingPlaceholder={
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3, 4].map((row) => (
              <Skeleton key={row} className="h-10 w-full" />
            ))}
          </div>
        }
        error={{
          title: t("list.error"),
          retryLabel: t("list.retry"),
          onRetry: () => void articlesQuery.refetch(),
        }}
        backgroundError={
          articlesQuery.isError && articles !== undefined
            ? {
                title: t("list.error"),
                retryLabel: t("list.retry"),
                onRetry: () => void articlesQuery.refetch(),
              }
            : undefined
        }
        empty={{
          title: t("list.empty"),
          action: (
            <Button size="sm" asChild>
              <Link href={`/${locale}/knowledge-base/new`}>{t("list.createButton")}</Link>
            </Button>
          ),
        }}
        noResults={{ title: t("list.noResults") }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("list.columns.title")}</TableHead>
              <TableHead>{t("list.columns.category")}</TableHead>
              <TableHead>{t("list.columns.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(articles ?? []).map((article) => (
              <ArticleRow key={article.id} article={article} />
            ))}
          </TableBody>
        </Table>
      </QueryStateCard>

      {/* Renders nothing while there is only one page (see `Pagination`),
          so a small library looks exactly as it did before S-8c. Disabled
          while the previous page is still showing, so a rapid double-click
          cannot queue a second jump. */}
      {articlePage !== undefined && (
        <Pagination
          page={articlePage.page}
          totalPages={articlePage.totalPages}
          onPageChange={(next) => setFilters((current) => ({ ...current, page: next }))}
          disabled={articlesQuery.isPlaceholderData}
          label={tCommon("pagination.label")}
          previousLabel={tCommon("pagination.previous")}
          nextLabel={tCommon("pagination.next")}
          indicator={tCommon("pagination.indicator", {
            page: articlePage.page,
            totalPages: articlePage.totalPages,
          })}
        />
      )}
    </section>
  );
}

/**
 * One existing article's row — a dedicated component (not inline in a
 * `.map()`) because `useUpdateArticleMutation` is a hook and must be called
 * once per component instance, not once per loop iteration (React's rules
 * of hooks — the same constraint `SlaPolicyRow`/`DepartmentRow` already
 * established elsewhere in this codebase).
 */
function ArticleRow({ article }: { article: ArticleSummary }) {
  const t = useTranslations("knowledgeBase");
  const errorMessage = useErrorMessage();
  const { locale } = useParams<{ locale: string }>();
  const mutation = useUpdateArticleMutation(article.id);
  const [confirmUnpublishOpen, setConfirmUnpublishOpen] = useState(false);

  function handleTogglePublishedClick() {
    if (article.status === "PUBLISHED") {
      setConfirmUnpublishOpen(true);
      return;
    }
    mutation.mutate({ status: "PUBLISHED" });
  }

  function confirmUnpublish() {
    mutation.mutate({ status: "DRAFT" }, { onSuccess: () => setConfirmUnpublishOpen(false) });
  }

  return (
    <TableRow>
      <TableCell>
        <Link
          href={`/${locale}/knowledge-base/${article.id}`}
          className="focus-ring rounded-sm text-start font-medium text-slate-800 hover:underline"
        >
          {article.title}
        </Link>
      </TableCell>
      <TableCell className="text-slate-500">{article.categoryName ?? t("list.noCategory")}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Badge variant={article.status === "PUBLISHED" ? "success" : "secondary"}>
            {article.status === "PUBLISHED" ? t("list.published") : t("list.draft")}
          </Badge>
          <Button
            variant={article.status === "PUBLISHED" ? "destructive" : "outline"}
            size="sm"
            disabled={mutation.isPending}
            onClick={handleTogglePublishedClick}
          >
            {article.status === "PUBLISHED" ? t("list.unpublish") : t("list.publish")}
          </Button>
          <ConfirmDialog
            open={confirmUnpublishOpen}
            onOpenChange={setConfirmUnpublishOpen}
            title={t("list.unpublishConfirmTitle")}
            description={t("list.unpublishConfirmDescription", { title: article.title })}
            confirmLabel={t("list.unpublish")}
            onConfirm={confirmUnpublish}
            isPending={mutation.isPending}
          />
        </div>
        {mutation.isError && (
          <p className="mt-1 text-xs text-red-600">
            {errorMessage(mutation.error, {
              forbidden: t("list.actionForbidden"),
              generic: t("list.actionFailed"),
            })}
          </p>
        )}
      </TableCell>
    </TableRow>
  );
}
