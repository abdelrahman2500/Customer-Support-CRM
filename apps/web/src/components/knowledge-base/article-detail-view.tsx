"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  useArticleQuery,
  useArticleVersionsQuery,
  useUpdateArticleMutation,
} from "@/hooks/use-knowledge-base";
import { ApiError } from "@/lib/api";
import { useErrorMessage } from "@/hooks/use-error-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/confirm-dialog";

/**
 * Story 51 — Article Detail/Edit. Mirrors `TicketDetailView`'s
 * loading/not-found/generic-error states exactly, and `SlaPolicyRow`'s
 * blur-commit-with-revert-on-error field pattern for title/body/category.
 * The publish/unpublish toggle mirrors `SlaPolicyRow`'s activate/deactivate
 * button (Design item 10).
 *
 * Story 65 — a read-only "Version History" section appended below the
 * existing fields (plan Design item 5); no other behavior changed.
 */
export function ArticleDetailView({ articleId }: { articleId: string }) {
  const t = useTranslations("knowledgeBase");
  const errorMessage = useErrorMessage();

  const articleQuery = useArticleQuery(articleId);
  const mutation = useUpdateArticleMutation(articleId);

  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [bodyDraft, setBodyDraft] = useState<string | null>(null);
  const [categoryDraft, setCategoryDraft] = useState<string | null>(null);
  const [confirmUnpublishOpen, setConfirmUnpublishOpen] = useState(false);

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

  const handleTogglePublishedClick = () => {
    if (article.status === "PUBLISHED") {
      setConfirmUnpublishOpen(true);
      return;
    }
    mutation.mutate({ status: "PUBLISHED" });
  };

  const confirmUnpublish = () => {
    mutation.mutate({ status: "DRAFT" }, { onSuccess: () => setConfirmUnpublishOpen(false) });
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
      </div>

      {mutation.isError && (
        <Alert variant="destructive">
          {errorMessage(mutation.error, {
            forbidden: t("detail.actionForbidden"),
            generic: t("detail.actionFailed"),
          })}
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

      <ArticleVersionHistory articleId={articleId} />
    </section>
  );
}

/** Story 65 — read-only; no restore action (plan Non-Goal). Mirrors
 * `ArticleListView`'s own loading/error/empty/populated shape. */
function ArticleVersionHistory({ articleId }: { articleId: string }) {
  const t = useTranslations("knowledgeBase");
  const versionsQuery = useArticleVersionsQuery(articleId);

  return (
    <section className="flex flex-col gap-2 border-t border-slate-200 pt-4">
      <h2 className="text-sm font-semibold text-slate-900">{t("detail.versions.title")}</h2>

      {versionsQuery.isLoading && <Skeleton className="h-10 w-full" />}

      {versionsQuery.isError && (
        <Alert variant="destructive">{t("detail.versions.error")}</Alert>
      )}

      {versionsQuery.isSuccess && versionsQuery.data.length === 0 && (
        <p className="text-sm text-slate-500">{t("detail.versions.empty")}</p>
      )}

      {versionsQuery.isSuccess && versionsQuery.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("detail.versions.columns.version")}</TableHead>
              <TableHead>{t("detail.versions.columns.title")}</TableHead>
              <TableHead>{t("detail.versions.columns.publishedAt")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {versionsQuery.data.map((version) => (
              <TableRow key={version.id}>
                <TableCell>{version.versionNumber}</TableCell>
                <TableCell>{version.title}</TableCell>
                <TableCell>{new Date(version.publishedAt).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
