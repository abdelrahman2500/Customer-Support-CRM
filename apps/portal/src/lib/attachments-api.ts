import { apiFetch, ApiError, getAccessToken, getApiBaseUrl } from "./api";

/**
 * Story 103 — Customer Portal: Ticket Attachment Upload. Mirrors
 * `apps/web/src/lib/attachments-api.ts`'s own shape, simplified: the
 * portal only ever deals with the authenticated contact's own ticket, so
 * there is no `AttachmentOwner` parameter — every function is scoped by
 * `ticketId` alone, mirroring `tickets-api.ts`'s own `/portal/tickets/:id/*`
 * path convention in this file.
 */
export interface AttachmentSummary {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  uploadedByUserId: string | null;
  uploadedByContactId: string | null;
  createdAt: string;
}

function attachmentsBasePath(ticketId: string): string {
  return `/portal/tickets/${ticketId}/attachments`;
}

export function listMyTicketAttachments(ticketId: string): Promise<AttachmentSummary[]> {
  return apiFetch<AttachmentSummary[]>(attachmentsBasePath(ticketId));
}

/**
 * A dedicated `fetch` call, not routed through `apiFetch` — mirrors
 * `apps/web`'s own `uploadAttachment`'s exact reasoning: `apiFetch`
 * unconditionally sets `Content-Type: application/json`, which would break
 * the browser's own multipart boundary header.
 */
export async function uploadMyTicketAttachment(
  ticketId: string,
  file: File,
): Promise<AttachmentSummary> {
  const formData = new FormData();
  formData.append("file", file);

  const token = getAccessToken();
  const response = await fetch(`${getApiBaseUrl()}${attachmentsBasePath(ticketId)}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = (await response.json()) as { message?: string | string[] };
      if (body.message) {
        message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
      }
    } catch {
      // Response body wasn't JSON — keep the generic status-based message.
    }
    throw new ApiError(message, response.status);
  }
  return (await response.json()) as AttachmentSummary;
}

/** Returns the presigned S3 URL as data (never a redirect) — mirrors
 * `apps/web`'s own `getAttachmentDownloadUrl`'s doc comment for why. */
export function getMyTicketAttachmentDownloadUrl(
  ticketId: string,
  attachmentId: string,
): Promise<{ url: string }> {
  return apiFetch<{ url: string }>(`${attachmentsBasePath(ticketId)}/${attachmentId}/download`);
}
