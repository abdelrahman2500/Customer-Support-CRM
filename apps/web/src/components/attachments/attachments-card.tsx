"use client";

import { useState } from "react";
import type { ChangeEvent } from "react";
import { useAttachmentsQuery, useUploadAttachmentMutation } from "@/hooks/use-attachments";
import { getAttachmentDownloadUrl } from "@/lib/attachments-api";
import type { AttachmentOwner } from "@/lib/attachments-api";
import { ApiError } from "@/lib/api";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

/** Every string this shared component needs, supplied by the caller's own
 * `next-intl` namespace (`tickets.detail.attachments*` or
 * `customers.detail.attachments*` — both mirror the same key shape) —
 * keeps this component decoupled from any one namespace. */
export interface AttachmentsCardStrings {
  heading: string;
  error: string;
  empty: string;
  uploading: string;
  uploadFailedFallback: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Story 66 — read-only list + a one-field upload form, mirroring
 * `TicketDetailView`'s Notes card own shape/JSX conventions. Client-side
 * size/MIME validation is a courtesy message only — the server-side check
 * (identical limits, `attachment-limits.ts`) is authoritative.
 *
 * Story 67 — extracted out of `ticket-detail-view.tsx` into its own file,
 * parametrized by `AttachmentOwner` (`"ticket"` or `"customer"`), so
 * `CustomerDetailView` reuses it rather than duplicating this JSX.
 */
export function AttachmentsCard({
  owner,
  locale,
  strings,
}: {
  owner: AttachmentOwner;
  locale: string;
  strings: AttachmentsCardStrings;
}) {
  const attachmentsQuery = useAttachmentsQuery(owner);

  async function handleDownload(attachmentId: string): Promise<void> {
    const { url } = await getAttachmentDownloadUrl(owner, attachmentId);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">{strings.heading}</h2>
      {attachmentsQuery.isLoading && <Skeleton className="mt-2 h-24 w-full" />}
      {attachmentsQuery.isError && (
        <Alert variant="destructive" className="mt-2">{strings.error}</Alert>
      )}
      {attachmentsQuery.isSuccess && attachmentsQuery.data.length === 0 && (
        <p className="mt-2 text-sm text-slate-500">{strings.empty}</p>
      )}
      {attachmentsQuery.isSuccess && attachmentsQuery.data.length > 0 && (
        <ol className="mt-2 flex flex-col gap-2 text-sm">
          {attachmentsQuery.data.map((attachment) => (
            <li key={attachment.id} className="flex items-center justify-between border-b border-slate-100 pb-2">
              <button
                type="button"
                className="text-left font-medium text-slate-800 hover:underline"
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
      <AddAttachmentForm owner={owner} strings={strings} />
    </div>
  );
}

function AddAttachmentForm({
  owner,
  strings,
}: {
  owner: AttachmentOwner;
  strings: AttachmentsCardStrings;
}) {
  const [error, setError] = useState<string | null>(null);
  const mutation = useUploadAttachmentMutation(owner);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file next time.
    if (!file) return;

    setError(null);
    try {
      await mutation.mutateAsync(file);
    } catch (uploadError) {
      setError(uploadError instanceof ApiError ? uploadError.message : strings.uploadFailedFallback);
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
      {mutation.isPending && <p className="text-xs text-slate-500">{strings.uploading}</p>}
      {error && <Alert variant="destructive">{error}</Alert>}
    </div>
  );
}
