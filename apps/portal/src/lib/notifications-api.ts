import { apiFetch } from "./api";

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
 * `GET /portal/notifications` — read-only, no query parameters, requires
 * only the portal audience (`@PortalRoute()`), no extra permission check
 * (unlike the agent-facing `GET /notifications`, which requires
 * `notification:read`).
 */
export function listMyNotifications(): Promise<PortalNotificationSummary[]> {
  return apiFetch<PortalNotificationSummary[]>("/portal/notifications");
}
