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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/confirm-dialog";

/**
 * Story 91 — Communication/Channels: Quick Replies. Mirrors
 * `AutomationRulesView`'s exact "table + inline add-form below it, no
 * separate route" single-page shape — an arbitrary, open-ended list, not
 * `NotificationTemplatesView`'s fixed-3-row shape.
 */
export function QuickRepliesView() {
  const t = useTranslations("quickReplies");
  const quickRepliesQuery = useQuickRepliesQuery();

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-slate-900">{t("title")}</h1>

      {quickRepliesQuery.isLoading && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-10 w-full" />
          ))}
        </div>
      )}

      {quickRepliesQuery.isError && (
        <Alert variant="destructive" className="flex items-center justify-between">
          <span>{t("error")}</span>
          <Button variant="outline" size="sm" onClick={() => quickRepliesQuery.refetch()}>
            {t("retry")}
          </Button>
        </Alert>
      )}

      {quickRepliesQuery.isSuccess && quickRepliesQuery.data.length === 0 && (
        <p className="rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          {t("empty")}
        </p>
      )}

      {quickRepliesQuery.isSuccess && quickRepliesQuery.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.title")}</TableHead>
              <TableHead>{t("columns.body")}</TableHead>
              <TableHead>{t("columns.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quickRepliesQuery.data.map((quickReply) => (
              <QuickReplyRow key={quickReply.id} quickReply={quickReply} />
            ))}
          </TableBody>
        </Table>
      )}

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
      <TableCell className="font-medium text-slate-800">{quickReply.title}</TableCell>
      <TableCell className="max-w-md truncate text-slate-500">{quickReply.body}</TableCell>
      <TableCell>
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
          <p className="mt-1 text-xs text-red-600">
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
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">{t("createHeading")}</h2>
      <form className="mt-3 flex flex-col gap-2" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          {t("titleLabel")}
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            minLength={1}
            className="w-72"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          {t("bodyLabel")}
          <textarea
            className="flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-ink-subtle focus-ring"
            rows={3}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
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
    </div>
  );
}
