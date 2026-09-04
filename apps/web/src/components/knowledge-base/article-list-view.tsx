"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useArticlesQuery, useUpdateArticleMutation } from "@/hooks/use-knowledge-base";
import type { ArticleSummary } from "@/lib/knowledge-base-api";
import { useErrorMessage } from "@/hooks/use-error-message";
import { Badge, Button, FetchingIndicator, Input, QueryStateCard, Skeleton } from "@crm/ui";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@crm/ui";

/**
 * Story 51 — Knowledge Base article list, over the new `GET
 * /knowledge-base/articles`. Mirrors `SlaPolicyListView`'s exact
 * loading/error/empty/populated conventions.
 *
 * Story 64 — a plain, un-debounced search input above the list (plan
 * Non-Goal explicitly defers debouncing/highlighting/snippets); local
 * `useState`, wired straight into `useArticlesQuery(search)`.
 */
export function ArticleListView() {
  const t = useTranslations("knowledgeBase");
  const tCommon = useTranslations("common");
  const { locale } = useParams<{ locale: string }>();
  const [search, setSearch] = useState("");

  const articlesQuery = useArticlesQuery(search);
  const articles = articlesQuery.data;

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

      <Input
        aria-label={t("list.searchLabel")}
        placeholder={t("list.searchPlaceholder")}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="max-w-sm"
      />

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
      <TableCell className="text-slate-500">{article.category ?? t("list.noCategory")}</TableCell>
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
