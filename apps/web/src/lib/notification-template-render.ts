/**
 * Story 63 — extracted from `notification-history-view.tsx`'s original,
 * Story 61 `renderTemplate` (kept byte-for-byte behavior) so
 * `NotificationToaster` can reuse the exact same substitution rules rather
 * than reimplementing them. Plain `{name}` substitution only — never
 * `next-intl`/ICU, since an admin-authored template is plain text, not a
 * message-catalog entry. `ticketId` is shortened to 8 characters, matching
 * the toaster's own pre-existing short-form convention. An unrecognized
 * placeholder is left verbatim (no error, simplest safe behavior).
 */
export interface NotificationTemplatePlaceholders {
  ticketId: string;
  targetType?: string | null;
}

export function renderNotificationTemplate(
  template: string,
  placeholders: NotificationTemplatePlaceholders,
): string {
  return template
    .replace(/\{ticketId\}/g, placeholders.ticketId.slice(0, 8))
    .replace(/\{targetType\}/g, placeholders.targetType ?? "");
}
