"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  useMyTicketAttachmentsQuery,
  useUploadMyTicketAttachmentMutation,
} from "@/hooks/use-portal-attachments";
import { getMyTicketAttachmentDownloadUrl } from "@/lib/attachments-api";
import { useErrorMessage } from "@/hooks/use-error-message";
import { Alert, FileDropzone, LoadingStatus, SectionCard, Skeleton } from "@crm/ui";
import { formatDateTime } from "@crm/ui";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Story 103 — Customer Portal: Ticket Attachment Upload. Mirrors
 * `apps/web`'s `AttachmentsCard`'s own list+upload-form shape, adapted to
 * this app's own inline error-block convention (`TicketDetailView`'s
 * History/CSAT cards) rather than a shared `Alert` component — this app
 * has none. Scoped by `ticketId` alone (the caller's own ticket — Contacts
 * have no cross-ticket attachment view).
 *
 * Story 230 (PR-5.2) — the upload control is the shared `FileDropzone`: a
 * named, keyboard-reachable drop area instead of the browser's bare
 * "Choose File" input, which was neither translated nor meaningful.
 */
export function TicketAttachmentsCard({ ticketId }: { ticketId: string }) {
  const t = useTranslations("tickets");
  const tCommon = useTranslations("common");
  const { locale } = useParams<{ locale: string }>();
  const attachmentsQuery = useMyTicketAttachmentsQuery(ticketId);

  async function handleDownload(attachmentId: string): Promise<void> {
    const { url } = await getMyTicketAttachmentDownloadUrl(ticketId, attachmentId);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <SectionCard title={t("detail.attachmentsHeading")}>
      {attachmentsQuery.isLoading && (
        <LoadingStatus label={tCommon("loading")} asChild>
          <Skeleton className="mt-2 h-16 w-full" />
        </LoadingStatus>
      )}
      {attachmentsQuery.isError && (
        <Alert variant="destructive" className="mt-2">
          {t("detail.attachmentsError")}
        </Alert>
      )}
      {attachmentsQuery.isSuccess && attachmentsQuery.data.length === 0 && (
        <p className="mt-2 text-sm text-ink-subtle">{t("detail.attachmentsEmpty")}</p>
      )}
      {attachmentsQuery.isSuccess && attachmentsQuery.data.length > 0 && (
        <ol className="mt-2 flex flex-col gap-2 text-sm">
          {attachmentsQuery.data.map((attachment) => (
            <li
              key={attachment.id}
              className="flex items-center justify-between border-b border-rule-subtle pb-2"
            >
              <button
                type="button"
                className="rounded-sm text-start font-medium text-ink-strong hover:underline focus-ring"
                onClick={() => void handleDownload(attachment.id)}
              >
                {attachment.filename}
              </button>
              <span className="text-ink-subtle">
                {formatFileSize(attachment.size)} · {formatDateTime(attachment.createdAt, locale)}
              </span>
            </li>
          ))}
        </ol>
      )}
      <AddAttachmentForm ticketId={ticketId} />
    </SectionCard>
  );
}

function AddAttachmentForm({ ticketId }: { ticketId: string }) {
  const t = useTranslations("tickets");
  const errorMessage = useErrorMessage();
  const [error, setError] = useState<string | null>(null);
  const mutation = useUploadMyTicketAttachmentMutation(ticketId);

  async function upload(file: File): Promise<void> {
    setError(null);
    try {
      await mutation.mutateAsync(file);
    } catch (uploadError) {
      setError(
        errorMessage(uploadError, {
          forbidden: t("detail.actionForbidden"),
          generic: t("detail.attachmentsUploadFailed"),
        }),
      );
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <FileDropzone
        label={t("detail.attachmentsAdd")}
        hint={t("detail.attachmentsHint")}
        disabled={mutation.isPending}
        onFile={(file) => void upload(file)}
      />
      <p role="status" className="text-xs text-ink-subtle empty:hidden">
        {mutation.isPending ? t("detail.attachmentsUploading") : ""}
      </p>
      {error && <Alert variant="destructive">{error}</Alert>}
    </div>
  );
}
