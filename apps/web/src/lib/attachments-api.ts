import { apiFetch, ApiError, getAccessToken, getApiBaseUrl } from "./api";

/**
 * Story 66 — Ticket Attachments Foundation. A dedicated API client file,
 * mirroring `knowledge-base-api.ts`'s own precedent: a distinct concern
 * with no forcing reason to share a file with `tickets-api.ts`.
 *
 * Story 67 — generalized to a `AttachmentOwner` parameter (`"ticket"` or
 * `"customer"`) rather than duplicating this file — the request/response
 * shapes are otherwise identical between `/tickets/:id/attachments` and
 * `/customers/:id/attachments`. `AttachmentSummary` omits the
 * owner-specific `ticketId`/`customerId` field the backend actually
 * returns — no call site in this codebase needs it (every consumer only
 * ever reads `id`/`filename`/`size`/etc.), and TypeScript's structural
 * typing means the extra field on the real response is simply ignored,
 * not stripped or invalid.
 */
export interface AttachmentSummary {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  uploadedByUserId: string;
  createdAt: string;
}

export type AttachmentOwner = { type: "ticket" | "customer"; id: string };

function ownerBasePath(owner: AttachmentOwner): string {
  const segment = owner.type === "ticket" ? "tickets" : "customers";
  return `/${segment}/${owner.id}/attachments`;
}

export function listAttachments(owner: AttachmentOwner): Promise<AttachmentSummary[]> {
  return apiFetch<AttachmentSummary[]>(ownerBasePath(owner));
}

/**
 * The first `multipart/form-data` request anywhere in this codebase — a
 * small, dedicated `fetch` call, not routed through `apiFetch`: that
 * helper unconditionally sets `Content-Type: application/json` whenever a
 * body is present, which would break the browser's own multipart boundary
 * header. Mirrors `apiFetch`'s own error-shape handling (a non-2xx
 * response becomes a typed `ApiError`).
 */
export async function uploadAttachment(
  owner: AttachmentOwner,
  file: File,
): Promise<AttachmentSummary> {
  const formData = new FormData();
  formData.append("file", file);

  const token = getAccessToken();
  const response = await fetch(`${getApiBaseUrl()}${ownerBasePath(owner)}`, {
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

/**
 * The presigned S3 URL as data (`GET .../download` returns JSON, never a
 * redirect — see the backend controller's own doc comment for the full
 * reasoning: a browser `fetch()` cannot reliably read a redirect's
 * `Location` header, and a plain `<a href>` cannot carry the bearer token
 * the endpoint needs). The caller performs a plain top-level navigation to
 * the returned URL — not subject to CORS, unlike a script-initiated read.
 */
export function getAttachmentDownloadUrl(
  owner: AttachmentOwner,
  attachmentId: string,
): Promise<{ url: string }> {
  return apiFetch<{ url: string }>(`${ownerBasePath(owner)}/${attachmentId}/download`);
}
