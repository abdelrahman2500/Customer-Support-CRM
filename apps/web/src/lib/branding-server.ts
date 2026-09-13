import { cookies } from "next/headers";
import { ACCESS_TOKEN_COOKIE, getApiBaseUrl } from "@/lib/api";
import type { BrandingSummary } from "@/lib/branding-api";

/**
 * Story 129 — the navigation layout decides the page's own shell (a row
 * for `SIDEBAR`, a column for `NAVBAR`), so resolving it in a client
 * `useQuery` would paint one layout and then swap to the other on every
 * single page load. Read server-side here instead, in the same request as
 * `fetchCurrentUser()`, and handed to `WorkspaceShell` as `initialData`.
 *
 * Deliberately the exact shape of `auth-server.ts`'s `fetchCurrentUser()`:
 * the same non-httpOnly access-token cookie the login page writes, the
 * same `cache: "no-store"`, and `null` on *any* failure (expired/invalid
 * token, network error, non-2xx response) rather than throwing.
 * `resolveNavigationLayout` treats `null` identically to "unconfigured",
 * so a branding outage degrades to the pre-Story-129 navbar rather than
 * to a broken page — a branding failure must never blank the workspace.
 */
export async function fetchBranding(): Promise<BrandingSummary | null> {
  const store = await cookies();
  const token = store.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) {
    return null;
  }
  try {
    const response = await fetch(`${getApiBaseUrl()}/branding`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as BrandingSummary;
  } catch {
    return null;
  }
}
