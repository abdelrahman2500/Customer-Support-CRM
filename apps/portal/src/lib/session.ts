import { getAccessToken } from "./api";
import { clearQueryCache } from "./query-client-registry";
import { usePortalNotificationsStore } from "./notifications-store";

/**
 * Final UX pass — everything this browser tab holds about the signed-in
 * person, forgotten in one place. Called when a session ends (sign-out, an
 * expired session) and when a new one begins (sign-in), so the next person
 * in the same tab never sees the previous one's data, name or permissions.
 *
 * Clearing the query cache alone was not enough: the signed-in layout is a
 * server component that renders the user (name, permissions, navigation),
 * and the Next.js client Router Cache kept serving the previous session's
 * copy of it after a client-side sign-in. `router.refresh()` purges that
 * cache, so the next navigation renders the layout for the new session.
 */
export function resetClientSession(router: { refresh: () => void }): void {
  clearQueryCache();
  usePortalNotificationsStore.setState({ notifications: [], recentKeys: {} });
  router.refresh();
}

/**
 * The subject (`sub`) of the access token in this tab's cookie, or `null`.
 * Read without verifying the signature: it is only compared with the user a
 * server-rendered layout was rendered for, to notice a stale copy — the API
 * verifies every token it receives.
 */
export function accessTokenSubject(): string | null {
  const token = getAccessToken();
  const payload = token?.split(".")[1];
  if (!payload) return null;
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const sub = (JSON.parse(json) as { sub?: unknown }).sub;
    return typeof sub === "string" ? sub : null;
  } catch {
    return null;
  }
}
