"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useArticlesQuery, useUpdateArticleMutation } from "@/hooks/use-knowledge-base";
import type { ArticleSummary } from "@/lib/knowledge-base-api";
import { ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const [search, setSearch] = useState("");

  const articlesQuery = useArticlesQuery(search);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">{t("list.title")}</h1>
        <Button size="sm" onClick={() => router.push(`/${locale}/knowledge-base/new`)}>
          {t("list.createButton")}
        </Button>
      </div>

      <Input
        aria-label={t("list.searchLabel")}
        placeholder={t("list.searchPlaceholder")}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="max-w-sm"
      />

      {articlesQuery.isLoading && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((row) => (
            <Skeleton key={row} className="h-10 w-full" />
          ))}
        </div>
      )}

      {articlesQuery.isError && (
        <Alert variant="destructive" className="flex items-center justify-between">
          <span>{t("list.error")}</span>
          <Button variant="outline" size="sm" onClick={() => articlesQuery.refetch()}>
            {t("list.retry")}
          </Button>
        </Alert>
      )}

      {articlesQuery.isSuccess && articlesQuery.data.length === 0 && search !== "" && (
        <div className="rounded-md border border-dashed border-slate-300 p-8 text-center">
          <p className="text-sm text-slate-500">{t("list.noResults")}</p>
        </div>
      )}

      {articlesQuery.isSuccess && articlesQuery.data.length === 0 && search === "" && (
        <div className="rounded-md border border-dashed border-slate-300 p-8 text-center">
          <p className="text-sm text-slate-500">{t("list.empty")}</p>
          <Button
            size="sm"
            className="mt-3"
            onClick={() => router.push(`/${locale}/knowledge-base/new`)}
          >
            {t("list.createButton")}
          </Button>
        </div>
      )}

      {articlesQuery.isSuccess && articlesQuery.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("list.columns.title")}</TableHead>
              <TableHead>{t("list.columns.category")}</TableHead>
              <TableHead>{t("list.columns.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {articlesQuery.data.map((article) => (
              <ArticleRow key={article.id} article={article} />
            ))}
          </TableBody>
        </Table>
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
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const mutation = useUpdateArticleMutation(article.id);

  function togglePublished() {
    mutation.mutate({ status: article.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED" });
  }

  return (
    <TableRow>
      <TableCell>
        <button
          type="button"
          className="text-left font-medium text-slate-800 hover:underline"
          onClick={() => router.push(`/${locale}/knowledge-base/${article.id}`)}
        >
          {article.title}
        </button>
      </TableCell>
      <TableCell className="text-slate-500">{article.category ?? t("list.noCategory")}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Badge variant={article.status === "PUBLISHED" ? "success" : "secondary"}>
            {article.status === "PUBLISHED" ? t("list.published") : t("list.draft")}
          </Badge>
          <Button variant="outline" size="sm" disabled={mutation.isPending} onClick={togglePublished}>
            {article.status === "PUBLISHED" ? t("list.unpublish") : t("list.publish")}
          </Button>
        </div>
        {mutation.isError && (
          <p className="mt-1 text-xs text-red-600">
            {mutation.error instanceof ApiError && mutation.error.status === 403
              ? t("list.actionForbidden")
              : t("list.actionFailed")}
          </p>
        )}
      </TableCell>
    </TableRow>
  );
}
