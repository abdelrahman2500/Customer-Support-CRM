"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  useCreateTicketKbReferenceMutation,
  useDeleteTicketKbReferenceMutation,
  useTicketKbReferencesQuery,
} from "@/hooks/use-ticket-kb-references";
import { usePublishedArticleSearchQuery } from "@/hooks/use-knowledge-base";
import { useErrorMessage } from "@/hooks/use-error-message";
import { Alert, Button, Input, Skeleton } from "@crm/ui";

/**
 * RM-05 — Ticket ↔ Knowledge Base Linkage. Mirrors `TicketDetailView`'s own
 * Notes/Attachments card shape: a read-only list (referenced articles, each
 * with a remove action) plus an inline create surface below it — here a
 * search-and-attach widget instead of a free-text form, since attaching
 * means picking an existing `PUBLISHED` article rather than writing new
 * content. Never optimistic: a successful attach/remove invalidates this
 * ticket's own references query, and the real, re-fetched list is what
 * renders the change. No confirmation dialog on remove — unlike a
 * password reset or portal-access revocation, removing a reference is
 * trivially reversible (re-attach the same article).
 */
export function TicketKbReferencesCard({ ticketId }: { ticketId: string }) {
  const t = useTranslations("tickets");
  const errorMessage = useErrorMessage();
  const referencesQuery = useTicketKbReferencesQuery(ticketId);
  const removeMutation = useDeleteTicketKbReferenceMutation(ticketId);
  const [removeError, setRemoveError] = useState<string | null>(null);

  function handleRemove(referenceId: string): void {
    setRemoveError(null);
    removeMutation.mutate(referenceId, {
      onError: (error) =>
        setRemoveError(
          errorMessage(error, {
            forbidden: t("detail.actionForbidden"),
            generic: t("detail.kbReferencesRemoveFailed"),
          }),
        ),
    });
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">{t("detail.kbReferencesHeading")}</h2>
      {referencesQuery.isLoading && <Skeleton className="mt-2 h-16 w-full" />}
      {referencesQuery.isError && (
        <Alert variant="destructive" className="mt-2">
          {t("detail.kbReferencesError")}
        </Alert>
      )}
      {referencesQuery.isSuccess && referencesQuery.data.length === 0 && (
        <p className="mt-2 text-sm text-slate-500">{t("detail.kbReferencesEmpty")}</p>
      )}
      {referencesQuery.isSuccess && referencesQuery.data.length > 0 && (
        <ul className="mt-2 flex flex-col gap-2 text-sm">
          {referencesQuery.data.map((reference) => (
            <li
              key={reference.id}
              className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2"
            >
              <span className="font-medium text-slate-800">{reference.articleTitle}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={removeMutation.isPending}
                onClick={() => handleRemove(reference.id)}
              >
                {t("detail.kbReferencesRemove")}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {removeError && (
        <Alert variant="destructive" className="mt-2">
          {removeError}
        </Alert>
      )}
      <AttachArticleForm ticketId={ticketId} />
    </div>
  );
}

function AttachArticleForm({ ticketId }: { ticketId: string }) {
  const t = useTranslations("tickets");
  const errorMessage = useErrorMessage();
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const searchQuery = usePublishedArticleSearchQuery(search);
  const mutation = useCreateTicketKbReferenceMutation(ticketId);

  async function handleAttach(articleId: string): Promise<void> {
    setError(null);
    try {
      await mutation.mutateAsync({ articleId });
      setSearch("");
    } catch (attachError) {
      setError(
        errorMessage(attachError, {
          forbidden: t("detail.actionForbidden"),
          generic: t("detail.kbReferencesAttachFailed"),
        }),
      );
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-xs text-slate-600">
        {t("detail.kbReferencesSearchLabel")}
        <Input
          value={search}
          placeholder={t("detail.kbReferencesSearchPlaceholder")}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      {searchQuery.isLoading && <Skeleton className="h-8 w-full" />}
      {searchQuery.isSuccess && search.trim().length > 0 && searchQuery.data.items.length === 0 && (
        <p className="text-sm text-slate-500">{t("detail.kbReferencesSearchEmpty")}</p>
      )}
      {searchQuery.isSuccess && searchQuery.data.items.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {searchQuery.data.items.map((article) => (
            <li key={article.id} className="flex items-center justify-between gap-2">
              <span className="truncate text-slate-800">{article.title}</span>
              <Button
                type="button"
                size="sm"
                disabled={mutation.isPending}
                onClick={() => void handleAttach(article.id)}
              >
                {mutation.isPending
                  ? t("detail.kbReferencesAttaching")
                  : t("detail.kbReferencesAttach")}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error && <Alert variant="destructive">{error}</Alert>}
    </div>
  );
}
