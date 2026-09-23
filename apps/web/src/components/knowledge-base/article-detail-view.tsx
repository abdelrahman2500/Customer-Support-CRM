"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  useArticleQuery,
  useArticleTranslationsQuery,
  useArticleVersionsQuery,
  useSetArticleTranslationMutation,
  useUpdateArticleMutation,
} from "@/hooks/use-knowledge-base";
import { useKbCategoriesQuery } from "@/hooks/use-kb-categories";
import { ApiError } from "@/lib/api";
import { useErrorMessage } from "@/hooks/use-error-message";
import { localeDirection } from "@/i18n/direction";
import {
  Alert,
  Badge,
  Button,
  Input,
  LoadingStatus,
  SectionCard,
  showSuccessToast,
  Skeleton,
} from "@crm/ui";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { AttachmentsCard } from "@/components/attachments/attachments-card";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@crm/ui";

/**
 * Story 51 — Article Detail/Edit. Mirrors `TicketDetailView`'s
 * loading/not-found/generic-error states exactly, and `SlaPolicyRow`'s
 * blur-commit-with-revert-on-error field pattern for title/body.
 * The publish/unpublish toggle mirrors `SlaPolicyRow`'s activate/deactivate
 * button (Design item 10).
 *
 * Story 65 — a read-only "Version History" section appended below the
 * existing fields (plan Design item 5); no other behavior changed.
 *
 * RM-27 — the free-text category `Input` became a `Select` sourced from
 * `useKbCategoriesQuery`, mirroring `TicketDetailView`'s own `categoryId`
 * `Select` exactly (commits immediately on selection, no blur-commit
 * needed since a `Select` has no intermediate typing state).
 *
 * RM-28 — an `AttachmentsCard` appended below the body field (plan Design
 * item: mirrors `TicketDetailView`/`CustomerDetailView`'s own placement),
 * reusing that shared component with `owner: { type: "kb-article" }` —
 * no new upload/list/download UI written here.
 */
/** Batch 2 (UX audit) — extracted so `loading.tsx` (the App Router route
 * segment shown during the RSC/bundle fetch, before this component has even
 * mounted) can render the identical shape, mirroring `TicketDetailSkeleton`/
 * `CustomerDetailSkeleton`'s own precedent exactly: one definition, two call
 * sites, zero visible swap between the route-level and query-level loading
 * states. */
export function ArticleDetailSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

export function ArticleDetailView({ articleId }: { articleId: string }) {
  const t = useTranslations("knowledgeBase");
  const tCommon = useTranslations("common");
  const errorMessage = useErrorMessage();
  const { locale } = useParams<{ locale: string }>();

  const articleQuery = useArticleQuery(articleId);
  const mutation = useUpdateArticleMutation(articleId);
  const categoriesQuery = useKbCategoriesQuery();

  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [bodyDraft, setBodyDraft] = useState<string | null>(null);
  /** Story 159 — the title is a heading until an author chooses to edit it. */
  const [editingTitle, setEditingTitle] = useState(false);
  const [confirmUnpublishOpen, setConfirmUnpublishOpen] = useState(false);

  if (articleQuery.isLoading) {
    return (
      <LoadingStatus label={tCommon("loading")} placeholderHidden={false}>
        <ArticleDetailSkeleton />
      </LoadingStatus>
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
      {/* Batch 3 (UX audit) — mirrors the portal's own `detail.backToList`
          pattern exactly (this screen never had one). `rtl:rotate-180` so
          "back" points the way back in both directions; `aria-hidden`
          since the adjacent label already names the action. */}
      <Link
        href={`/${locale}/knowledge-base`}
        className="focus-ring self-start rounded-sm text-sm font-medium text-ink-muted hover:text-ink hover:underline"
      >
        <span aria-hidden="true" className="inline-block rtl:rotate-180">
          &larr;
        </span>{" "}
        {t("detail.backToList")}
      </Link>

      {/* Story 159 — a real, visible page title, adopting Story 156's
          ticket-detail pattern.

          NAV-2 added an `sr-only` h1 because the title was an
          always-editable `Input`, so the page had no visible heading at
          all — the right accessibility patch for a layout problem it could
          not fix. The page read as a form rather than a record, and its
          most important text was the one thing not rendered as text.

          The title is still editable through the same `PATCH`, with the
          same blur-commit and the same revert-on-error; editing is now an
          explicit mode instead of the permanent state. The `h1` carries
          the title in both modes, so the document outline never depends on
          which mode is active. `flex-wrap` keeps the status badge and the
          publish action beside a long title rather than off the screen.

          This page keeps its single full-width column: unlike ticket
          detail, it is a content editor whose body `Textarea` is the work
          surface, and it already organizes itself through Story 137's
          locale `Tabs`. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {editingTitle ? (
          <>
            <h1 className="sr-only">{article.title}</h1>
            <Input
              autoFocus
              className="w-full max-w-md text-lg font-semibold"
              // Batch 5 (UX audit) — controlled (not `defaultValue`) so a
              // rejected edit can be explicitly reverted, mirroring
              // `SlaPolicyRow`'s own blur-commit-with-revert-on-error pattern.
              value={titleDraft ?? article.title}
              aria-label={t("detail.titleLabel")}
              onChange={(event) => setTitleDraft(event.target.value)}
              onKeyDown={(event) => {
                // Escape abandons the edit; the draft resets so reopening
                // starts from the server's value, never a stale keystroke.
                if (event.key === "Escape") {
                  setTitleDraft(article.title);
                  setEditingTitle(false);
                }
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
              }}
              onBlur={() => {
                const value = titleDraft?.trim();
                if (value && titleDraft !== article.title) {
                  mutation.mutate(
                    { title: value },
                    { onError: () => setTitleDraft(article.title) },
                  );
                }
                setEditingTitle(false);
              }}
            />
          </>
        ) : (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold text-ink">{article.title}</h1>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditingTitle(true)}>
              {t("detail.titleEdit")}
            </Button>
          </div>
        )}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
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

      {/* Story 137 — the article's own content, per locale. The base
          (English) panel below is the pre-existing editor, moved wholesale
          and otherwise untouched: same fields, same drafts, same
          blur-commit handlers, same order. `defaultValue="en"` keeps it the
          panel that renders on mount. `dir` is required, not decorative —
          Radix follows the document direction for arrow-key movement
          between tabs (see `packages/ui/src/components/tabs.tsx`). */}
      <Tabs defaultValue="en" dir={localeDirection(locale)}>
        <TabsList>
          <TabsTrigger value="en">{t("detail.locales.en")}</TabsTrigger>
          <TabsTrigger value="ar">{t("detail.locales.ar")}</TabsTrigger>
        </TabsList>

        <TabsContent value="en" className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            {t("detail.categoryLabel")}
            <Select
              value={article.categoryId ?? undefined}
              disabled={mutation.isPending || categoriesQuery.isLoading}
              onValueChange={(value) => mutation.mutate({ categoryId: value })}
            >
              <SelectTrigger aria-label={t("detail.categoryLabel")} className="max-w-xs">
                <SelectValue
                  placeholder={
                    categoriesQuery.isLoading ? t("detail.optionsLoading") : t("detail.noCategory")
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {(categoriesQuery.data ?? []).map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {categoriesQuery.isError && (
              <span className="text-xs text-danger-foreground">
                {t("detail.categoryLoadError")}
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            {t("detail.bodyLabel")}
            <Textarea
              rows={10}
              // Batch 5 (UX audit) — controlled, same revert-on-error rationale
              // as the title field above.
              value={bodyDraft ?? article.body}
              onChange={(event) => setBodyDraft(event.target.value)}
              onBlur={() => {
                const value = bodyDraft?.trim();
                if (value && bodyDraft !== article.body) {
                  mutation.mutate({ body: value }, { onError: () => setBodyDraft(article.body) });
                }
              }}
            />
          </label>

          <AttachmentsCard
            owner={{ type: "kb-article", id: articleId }}
            locale={locale}
            strings={{
              heading: t("detail.attachmentsHeading"),
              error: t("detail.attachmentsError"),
              empty: t("detail.attachmentsEmpty"),
              uploading: t("detail.attachmentsUploading"),
              uploadFailedFallback: t("detail.attachmentsUploadFailed"),
              uploadForbidden: t("detail.actionForbidden"),
            }}
          />

          <ArticleVersionHistory articleId={articleId} />
        </TabsContent>

        <TabsContent value="ar">
          <ArticleTranslationEditor articleId={articleId} />
        </TabsContent>
      </Tabs>
    </section>
  );
}

/** Story 65 — read-only; no restore action (plan Non-Goal). Mirrors
 * `ArticleListView`'s own loading/error/empty/populated shape. */
function ArticleVersionHistory({ articleId }: { articleId: string }) {
  const t = useTranslations("knowledgeBase");
  const tCommon = useTranslations("common");
  // Same locale-aware date convention every other table in this app uses
  // (e.g. `audit-log-view.tsx`); omitting `locale` formats in the browser's
  // own locale rather than the one the user selected.
  const { locale } = useParams<{ locale: string }>();
  const versionsQuery = useArticleVersionsQuery(articleId);

  // Story 159 — a `SectionCard` rather than a hairline-separated `<section>`,
  // so version history reads as a peer of the article's other panels instead
  // of an afterthought appended below them. `SectionCard` supplies the `h2`
  // (Story 154's `headingLevel`), which is the level this heading already had.
  return (
    <SectionCard title={t("detail.versions.title")} className="flex flex-col gap-2">
      {versionsQuery.isLoading && (
        <LoadingStatus label={tCommon("loading")} asChild>
          <Skeleton className="h-10 w-full" />
        </LoadingStatus>
      )}

      {versionsQuery.isError && <Alert variant="destructive">{t("detail.versions.error")}</Alert>}

      {versionsQuery.isSuccess && versionsQuery.data.length === 0 && (
        <p className="text-sm text-ink-subtle">{t("detail.versions.empty")}</p>
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
                {/* Story 150 — labels reuse each column's own header key. */}
                <TableCell label={t("detail.versions.columns.version")}>
                  {version.versionNumber}
                </TableCell>
                <TableCell label={t("detail.versions.columns.title")}>{version.title}</TableCell>
                <TableCell label={t("detail.versions.columns.publishedAt")}>
                  {new Date(version.publishedAt).toLocaleString(locale)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </SectionCard>
  );
}

/**
 * Story 137 — Arabic translation authoring over Story 109's already-shipped
 * endpoints (`GET .../translations`, `PUT .../translations/AR`). No backend
 * change; this is the authoring UI Story 109's own Non-goals deferred.
 *
 * Explicit save, deliberately NOT the base editor's blur-commit: `PUT
 * .../translations/:locale` requires BOTH `title` and `body` and replaces
 * them wholesale (`SetArticleTranslationDto`, and the API e2e case "re-
 * setting the same locale replaces the translation wholesale (upsert), not
 * merge"). A per-field commit would have to silently resend the other
 * field, so the two fields are saved together or not at all.
 *
 * `dir="rtl"` on the fields is independent of the app's own UI locale: an
 * agent working in English still types Arabic into them.
 */
function ArticleTranslationEditor({ articleId }: { articleId: string }) {
  const t = useTranslations("knowledgeBase");
  const tCommon = useTranslations("common");
  const errorMessage = useErrorMessage();

  const translationsQuery = useArticleTranslationsQuery(articleId);
  const mutation = useSetArticleTranslationMutation(articleId, "AR");

  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [bodyDraft, setBodyDraft] = useState<string | null>(null);

  /** The endpoint returns an unordered array of at most two rows (one per
   * `KbLocale`), never a keyed object — find by locale, never by position. */
  const existing = translationsQuery.data?.find((row) => row.locale === "AR");

  // Same draft-or-server shape the base editor uses, so a freshly saved
  // server value flows back in once the query is invalidated.
  const title = titleDraft ?? existing?.title ?? "";
  const body = bodyDraft ?? existing?.body ?? "";

  if (translationsQuery.isLoading) {
    return (
      <LoadingStatus label={tCommon("loading")} asChild>
        <Skeleton className="h-32 w-full" />
      </LoadingStatus>
    );
  }

  if (translationsQuery.isError) {
    return (
      <Alert variant="destructive">
        {errorMessage(translationsQuery.error, {
          forbidden: t("detail.actionForbidden"),
          generic: t("detail.translations.loadError"),
        })}
      </Alert>
    );
  }

  const canSave = title.trim().length > 0 && body.trim().length > 0;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-ink">{t("detail.translations.heading")}</h2>

      {/* `GET` returns `[]` — not a 404 — for an article with no translation
          yet. That is the empty state, never an error. */}
      {existing === undefined && (
        <p className="text-sm text-ink-subtle">{t("detail.translations.none")}</p>
      )}

      {mutation.isError && (
        <Alert variant="destructive">
          {errorMessage(mutation.error, {
            forbidden: t("detail.actionForbidden"),
            generic: t("detail.translations.saveFailed"),
          })}
        </Alert>
      )}

      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        {t("detail.translations.titleLabel")}
        <Input
          className="max-w-md"
          dir="rtl"
          value={title}
          aria-label={t("detail.translations.titleLabel")}
          onChange={(event) => setTitleDraft(event.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        {t("detail.translations.bodyLabel")}
        <Textarea
          rows={10}
          dir="rtl"
          value={body}
          aria-label={t("detail.translations.bodyLabel")}
          onChange={(event) => setBodyDraft(event.target.value)}
        />
      </label>

      <Button
        className="w-fit"
        // The client half of the backend's own `@MinLength(1)`; trimmed, so
        // a whitespace-only value cannot be submitted either.
        disabled={mutation.isPending || !canSave}
        onClick={() =>
          mutation.mutate(
            { title: title.trim(), body: body.trim() },
            {
              onSuccess: () => {
                // Drop the local drafts so the re-fetched server values are
                // what renders next.
                setTitleDraft(null);
                setBodyDraft(null);
                showSuccessToast(t("detail.translations.saveSuccess"));
              },
            },
          )
        }
      >
        {mutation.isPending ? t("detail.translations.saving") : t("detail.translations.save")}
      </Button>
    </div>
  );
}
