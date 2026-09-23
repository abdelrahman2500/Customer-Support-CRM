"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import {
  useCreateQuickReplyMutation,
  useQuickRepliesQuery,
  useUpdateQuickReplyMutation,
} from "@/hooks/use-quick-replies";
import type { QuickReplySummary } from "@/lib/quick-replies-api";
import { useErrorMessage } from "@/hooks/use-error-message";
import {
  Alert,
  Badge,
  Button,
  Input,
  PageHeader,
  QueryStateCard,
  SectionCard,
  Skeleton,
  Textarea,
} from "@crm/ui";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@crm/ui";

/**
 * Story 91 — Communication/Channels: Quick Replies. Mirrors
 * `AutomationRulesView`'s exact "table + inline add-form below it, no
 * separate route" single-page shape — an arbitrary, open-ended list, not
 * `NotificationTemplatesView`'s fixed-3-row shape.
 */
export function QuickRepliesView() {
  const t = useTranslations("quickReplies");
  const tCommon = useTranslations("common");
  const quickRepliesQuery = useQuickRepliesQuery();

  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={t("title")} />

      {/* Story 155 — the hand-rolled four-branch ladder, replaced by the
          shared primitive. Same skeleton, same retry, same empty copy.
          `isError` now also requires `data === undefined`, so a failed
          background refetch keeps the rows on screen instead of throwing
          away readable content (Story S-7's reasoning). */}
      <QueryStateCard
        isLoading={quickRepliesQuery.isLoading}
        isError={quickRepliesQuery.isError && quickRepliesQuery.data === undefined}
        isEmpty={quickRepliesQuery.isSuccess && quickRepliesQuery.data.length === 0}
        loadingLabel={tCommon("loading")}
        loadingPlaceholder={
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-10 w-full" />
            ))}
          </div>
        }
        error={{
          title: t("error"),
          retryLabel: t("retry"),
          onRetry: () => void quickRepliesQuery.refetch(),
        }}
        backgroundError={
          quickRepliesQuery.isError && quickRepliesQuery.data !== undefined
            ? {
                title: t("error"),
                retryLabel: t("retry"),
                onRetry: () => void quickRepliesQuery.refetch(),
              }
            : undefined
        }
        empty={{ title: t("empty") }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.title")}</TableHead>
              <TableHead>{t("columns.body")}</TableHead>
              <TableHead>{t("columns.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(quickRepliesQuery.data ?? []).map((quickReply) => (
              <QuickReplyRow key={quickReply.id} quickReply={quickReply} />
            ))}
          </TableBody>
        </Table>
      </QueryStateCard>

      <AddQuickReplyForm />
    </section>
  );
}

/** One existing quick reply's row — a dedicated component so
 * `useUpdateQuickReplyMutation` is called once per row, mirroring
 * `AutomationRuleRow`'s Rules-of-Hooks convention. */
function QuickReplyRow({ quickReply }: { quickReply: QuickReplySummary }) {
  const t = useTranslations("quickReplies");
  const errorMessage = useErrorMessage();
  const mutation = useUpdateQuickReplyMutation(quickReply.id);
  const [confirmDeactivateOpen, setConfirmDeactivateOpen] = useState(false);

  function handleToggleActiveClick() {
    if (quickReply.isActive) {
      setConfirmDeactivateOpen(true);
      return;
    }
    mutation.mutate({ isActive: true });
  }

  function confirmDeactivate() {
    mutation.mutate({ isActive: false }, { onSuccess: () => setConfirmDeactivateOpen(false) });
  }

  return (
    <TableRow>
      {/* Story 150 — labels reuse each column's own header key. */}
      <TableCell label={t("columns.title")} className="font-medium text-ink-strong">
        {quickReply.title}
      </TableCell>
      <TableCell label={t("columns.body")} className="max-w-md truncate text-ink-subtle">
        {quickReply.body}
      </TableCell>
      <TableCell label={t("columns.status")}>
        <div className="flex items-center gap-2">
          <Badge variant={quickReply.isActive ? "success" : "secondary"}>
            {quickReply.isActive ? t("active") : t("inactive")}
          </Badge>
          <Button
            variant={quickReply.isActive ? "destructive" : "outline"}
            size="sm"
            disabled={mutation.isPending}
            onClick={handleToggleActiveClick}
          >
            {quickReply.isActive ? t("deactivate") : t("activate")}
          </Button>
          <ConfirmDialog
            open={confirmDeactivateOpen}
            onOpenChange={setConfirmDeactivateOpen}
            title={t("deactivateConfirmTitle")}
            description={t("deactivateConfirmDescription", { title: quickReply.title })}
            confirmLabel={t("deactivate")}
            onConfirm={confirmDeactivate}
            isPending={mutation.isPending}
          />
        </div>
        {mutation.isError && (
          <p className="mt-1 text-xs text-danger-foreground">
            {errorMessage(mutation.error, {
              forbidden: t("actionForbidden"),
              generic: t("actionFailed"),
            })}
          </p>
        )}
      </TableCell>
    </TableRow>
  );
}

/** The smallest UI surface for a create form — an inline form below the
 * table, mirroring `AddAutomationRuleForm`'s exact submit/error pattern. */
function AddQuickReplyForm() {
  const t = useTranslations("quickReplies");
  const errorMessage = useErrorMessage();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mutation = useCreateQuickReplyMutation();

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await mutation.mutateAsync({ title: title.trim(), body: body.trim() });
      setTitle("");
      setBody("");
    } catch (submitError) {
      setError(
        errorMessage(submitError, { forbidden: t("actionForbidden"), generic: t("createFailed") }),
      );
    }
  }

  return (
    <SectionCard title={t("createHeading")}>
      <form className="mt-3 flex flex-col gap-2" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          {t("titleLabel")}
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            minLength={1}
            className="w-full sm:w-72"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          {t("bodyLabel")}
          <Textarea rows={3} value={body} onChange={(event) => setBody(event.target.value)} />
        </label>
        <div>
          <Button
            type="submit"
            size="sm"
            disabled={mutation.isPending || !title.trim() || !body.trim()}
          >
            {mutation.isPending ? t("createSubmitting") : t("createSubmit")}
          </Button>
        </div>
        {error && <Alert variant="destructive">{error}</Alert>}
      </form>
    </SectionCard>
  );
}
