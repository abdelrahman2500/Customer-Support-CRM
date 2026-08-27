import { cookies } from "next/headers";
import type { AuthenticatedUser } from "@crm/shared";
import { ACCESS_TOKEN_COOKIE, getApiBaseUrl } from "@/lib/api";

/**
 * Story 28 — extracted verbatim from `(agent)/layout.tsx`'s original inline
 * `fetchMe()` (Story 23) so the new dashboard page can resolve the
 * authenticated user server-side without a second, independently-drifting
 * implementation of "who am I". Behavior is unchanged: reads the same
 * non-httpOnly access-token cookie the login page writes, calls the same
 * `GET /auth/me`, and returns `null` on any failure (expired/invalid token,
 * network error, non-2xx response) rather than throwing.
 */
export async function fetchCurrentUser(): Promise<AuthenticatedUser | null> {
  const store = await cookies();
  const token = store.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) {
    return null;
  }
  try {
    const response = await fetch(`${getApiBaseUrl()}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as AuthenticatedUser;
  } catch {
    return null;
  }
}
