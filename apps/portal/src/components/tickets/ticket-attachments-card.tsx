"use client";

import { useState, type ChangeEvent } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  useMyTicketAttachmentsQuery,
  useUploadMyTicketAttachmentMutation,
} from "@/hooks/use-portal-attachments";
import { getMyTicketAttachmentDownloadUrl } from "@/lib/attachments-api";
import { ApiError } from "@/lib/api";
import { Skeleton } from "@/components/portal/skeleton";

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
 */
export function TicketAttachmentsCard({ ticketId }: { ticketId: string }) {
  const t = useTranslations("tickets");
  const { locale } = useParams<{ locale: string }>();
  const attachmentsQuery = useMyTicketAttachmentsQuery(ticketId);

  async function handleDownload(attachmentId: string): Promise<void> {
    const { url } = await getMyTicketAttachmentDownloadUrl(ticketId, attachmentId);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">{t("detail.attachmentsHeading")}</h2>
      {attachmentsQuery.isLoading && <Skeleton className="mt-2 h-16 w-full" />}
      {attachmentsQuery.isError && (
        <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {t("detail.attachmentsError")}
        </div>
      )}
      {attachmentsQuery.isSuccess && attachmentsQuery.data.length === 0 && (
        <p className="mt-2 text-sm text-slate-500">{t("detail.attachmentsEmpty")}</p>
      )}
      {attachmentsQuery.isSuccess && attachmentsQuery.data.length > 0 && (
        <ol className="mt-2 flex flex-col gap-2 text-sm">
          {attachmentsQuery.data.map((attachment) => (
            <li
              key={attachment.id}
              className="flex items-center justify-between border-b border-slate-100 pb-2"
            >
              <button
                type="button"
                className="rounded-sm text-start font-medium text-slate-800 hover:underline focus-ring"
                onClick={() => void handleDownload(attachment.id)}
              >
                {attachment.filename}
              </button>
              <span className="text-slate-500">
                {formatFileSize(attachment.size)} ·{" "}
                {new Date(attachment.createdAt).toLocaleString(locale)}
              </span>
            </li>
          ))}
        </ol>
      )}
      <AddAttachmentForm ticketId={ticketId} />
    </div>
  );
}

function AddAttachmentForm({ ticketId }: { ticketId: string }) {
  const t = useTranslations("tickets");
  const [error, setError] = useState<string | null>(null);
  const mutation = useUploadMyTicketAttachmentMutation(ticketId);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file next time.
    if (!file) return;

    setError(null);
    try {
      await mutation.mutateAsync(file);
    } catch (uploadError) {
      setError(
        uploadError instanceof ApiError ? uploadError.message : t("detail.attachmentsUploadFailed"),
      );
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-xs text-slate-600">
        <input
          type="file"
          disabled={mutation.isPending}
          onChange={(event) => void handleFileChange(event)}
          className="text-sm text-slate-700"
        />
      </label>
      {mutation.isPending && (
        <p className="text-xs text-slate-500">{t("detail.attachmentsUploading")}</p>
      )}
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
