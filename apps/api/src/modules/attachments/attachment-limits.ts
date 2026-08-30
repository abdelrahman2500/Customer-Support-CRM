/**
 * Story 66 — enforced server-side, never trusting the browser (plan
 * Security risks/mitigations). A small, explicit allow-list rather than a
 * deny-list, mirroring this codebase's own "only what's evidenced" modeling
 * restraint (e.g. `KnowledgeBaseArticleStatus`'s own two-value enum).
 */
export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export function isAllowedAttachmentMimeType(mimeType: string): boolean {
  return (ALLOWED_ATTACHMENT_MIME_TYPES as readonly string[]).includes(mimeType);
}
