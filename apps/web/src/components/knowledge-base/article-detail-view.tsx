"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useArticleQuery, useUpdateArticleMutation } from "@/hooks/use-knowledge-base";
import { ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Story 51 — Article Detail/Edit. Mirrors `TicketDetailView`'s
 * loading/not-found/generic-error states exactly, and `SlaPolicyRow`'s
 * blur-commit-with-revert-on-error field pattern for title/body/category.
 * The publish/unpublish toggle mirrors `SlaPolicyRow`'s activate/deactivate
 * button (Design item 10).
 */
export function ArticleDetailView({ articleId }: { articleId: string }) {
  const t = useTranslations("knowledgeBase");

  const articleQuery = useArticleQuery(articleId);
  const mutation = useUpdateArticleMutation(articleId);

  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [bodyDraft, setBodyDraft] = useState<string | null>(null);
  const [categoryDraft, setCategoryDraft] = useState<string | null>(null);

  if (articleQuery.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
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

  const togglePublished = () => {
    mutation.mutate({ status: article.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED" });
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Input
          className="max-w-md text-lg font-semibold"
          defaultValue={article.title}
          aria-label={t("detail.titleLabel")}
          onChange={(event) => setTitleDraft(event.target.value)}
          onBlur={() => {
            const value = titleDraft?.trim();
            if (value && titleDraft !== article.title) {
              mutation.mutate({ title: value });
            }
          }}
        />
        <div className="flex items-center gap-2">
          <Badge variant={article.status === "PUBLISHED" ? "success" : "secondary"}>
            {article.status === "PUBLISHED" ? t("list.published") : t("list.draft")}
          </Badge>
          <Button variant="outline" size="sm" disabled={mutation.isPending} onClick={togglePublished}>
            {article.status === "PUBLISHED" ? t("list.unpublish") : t("list.publish")}
          </Button>
        </div>
      </div>

      {mutation.isError && (
        <Alert variant="destructive">
          {mutation.error instanceof ApiError && mutation.error.status === 403
            ? t("detail.actionForbidden")
            : t("detail.actionFailed")}
        </Alert>
      )}

      <label className="flex flex-col gap-1 text-xs text-slate-600">
        {t("detail.categoryLabel")}
        <Input
          className="max-w-xs"
          defaultValue={article.category ?? ""}
          onChange={(event) => setCategoryDraft(event.target.value)}
          onBlur={() => {
            if (categoryDraft !== null && categoryDraft !== (article.category ?? "")) {
              mutation.mutate({ category: categoryDraft });
            }
          }}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-slate-600">
        {t("detail.bodyLabel")}
        <textarea
          className="flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          rows={10}
          defaultValue={article.body}
          onChange={(event) => setBodyDraft(event.target.value)}
          onBlur={() => {
            const value = bodyDraft?.trim();
            if (value && bodyDraft !== article.body) {
              mutation.mutate({ body: value });
            }
          }}
        />
      </label>
    </section>
  );
}
