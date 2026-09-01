import { apiFetch } from "./api";

/**
 * Story 39 — Agent Workspace: Notification History. A dedicated API client
 * file (same "own domain, no forced coupling to `tickets-api.ts`"
 * convention `sla-policies-api.ts`/`roles-api.ts`/`business-hours-api.ts`
 * already established): notification history is a distinct domain from
 * tickets/customers/users, so this file does not import from or re-export
 * anything in `tickets-api.ts`.
 *
 * Mirrors the backend's own `NotificationSummary`
 * (`apps/api/src/modules/notifications/notifications.service.ts`) exactly —
 * confirmed against that file during implementation. `dedupeKey` is
 * deliberately excluded there (an internal dedup identity mechanism with no
 * meaning to an API consumer) and is not repeated here. `targetAt`/`loggedAt`
 * are `Date` columns server-side but arrive over HTTP as ISO strings, same
 * as every other timestamp field this codebase already consumes
 * (`TicketSummary.createdAt`, etc.) — never re-parsed into `Date` until a
 * component actually needs to format one.
 */
export interface NotificationSummary {
  id: string;
  eventType: string;
  ticketId: string;
  branchId: string | null;
  targetType: string | null;
  targetAt: string | null;
  loggedAt: string;
}

/**
 * `GET /notifications` — read-only, no query parameters (mirrors every
 * other list endpoint in this codebase), requires the `notification:read`
 * permission (Story 36) a plain Agent does not hold — a 403 is a real,
 * expected response this client's caller must handle, not a bug.
 */
export function listNotifications(): Promise<NotificationSummary[]> {
  return apiFetch<NotificationSummary[]>("/notifications");
}

/**
 * Story 92 — `GET /notifications/unread-count`. Same `notification:read`
 * gate as `listNotifications()` (a dedicated endpoint, not a field folded
 * into that list's existing raw-array response shape).
 */
export function getUnreadNotificationCount(): Promise<{ unreadCount: number }> {
  return apiFetch<{ unreadCount: number }>("/notifications/unread-count");
}

/**
 * Story 92 — `PATCH /notifications/read-state`. Advances the caller's own
 * read cursor to the server's current time; takes no request body — the
 * caller's identity is resolved server-side, never sent from here.
 */
export function markNotificationsRead(): Promise<{ readAt: string }> {
  return apiFetch<{ readAt: string }>("/notifications/read-state", { method: "PATCH" });
}
