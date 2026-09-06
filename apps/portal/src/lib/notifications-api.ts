import { apiFetch } from "./api";
import type { PaginatedResponse } from "./paginated";

/**
 * Story 89 — Customer Portal: Notification History (Frontend). A dedicated
 * API client file (same "own domain, no forced coupling to
 * `tickets-api.ts`" convention `branding-api.ts`/`knowledge-base-api.ts`/
 * `chat-api.ts` already established in this directory) over `GET
 * /portal/notifications` (Story 88, unmodified).
 *
 * Mirrors the backend's own `NotificationSummary`
 * (`apps/api/src/modules/notifications/notifications.service.ts`) and
 * `apps/web/src/lib/notifications-api.ts`'s independent re-declaration
 * convention exactly. `branchId`/`targetType`/`targetAt` are always `null`
 * for customer-scoped rows (Story 88's own doc comment), but the fields
 * stay in the type for parity with the shared backend shape. `targetAt`/
 * `loggedAt` are `Date` columns server-side but arrive over HTTP as ISO
 * strings, same as every other timestamp field this app's clients consume.
 */
export interface PortalNotificationSummary {
  id: string;
  eventType: string;
  ticketId: string;
  branchId: string | null;
  targetType: string | null;
  targetAt: string | null;
  loggedAt: string;
}

/**
 * PORTAL-2 — Customer Portal Notification Pagination. Mirrors
 * `tickets-api.ts`'s own `toQueryString` convention: an omitted
 * `page`/`pageSize` produces the exact same request every existing caller
 * already sends.
 */
function toQueryString(pagination: { page?: number; pageSize?: number } = {}): string {
  const params = new URLSearchParams();
  if (pagination.page !== undefined) {
    params.set("page", String(pagination.page));
  }
  if (pagination.pageSize !== undefined) {
    params.set("pageSize", String(pagination.pageSize));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

/**
 * `GET /portal/notifications` — requires only the portal audience
 * (`@PortalRoute()`), no extra permission check (unlike the agent-facing
 * `GET /notifications`, which requires `notification:read`). No filters
 * exist for this list, only pagination.
 */
export function listMyNotifications(
  pagination: { page?: number; pageSize?: number } = {},
): Promise<PaginatedResponse<PortalNotificationSummary>> {
  return apiFetch<PaginatedResponse<PortalNotificationSummary>>(
    `/portal/notifications${toQueryString(pagination)}`,
  );
}

/**
 * Story 92 — `GET /portal/notifications/unread-count`. Same `@PortalRoute()`-only
 * gate as `listMyNotifications()` (a dedicated endpoint, not a field folded
 * into that list's existing raw-array response shape).
 */
export function getUnreadNotificationCount(): Promise<{ unreadCount: number }> {
  return apiFetch<{ unreadCount: number }>("/portal/notifications/unread-count");
}

/**
 * Story 92 — `PATCH /portal/notifications/read-state`. Advances the
 * calling Contact's own read cursor to the server's current time; takes no
 * request body — the caller's identity is resolved server-side from the
 * portal JWT, never sent from here.
 */
export function markNotificationsRead(): Promise<{ readAt: string }> {
  return apiFetch<{ readAt: string }>("/portal/notifications/read-state", { method: "PATCH" });
}
