import { cookies } from "next/headers";
import type { AuthenticatedContact } from "@crm/shared";
import { ACCESS_TOKEN_COOKIE, getApiBaseUrl } from "@/lib/api";

/**
 * Story 52 — mirrors `apps/web/src/lib/auth-server.ts`'s `fetchCurrentUser`
 * exactly, retargeted to `GET /portal/auth/me` and `AuthenticatedContact`.
 * Returns `null` on any failure (expired/invalid token, network error,
 * non-2xx response) rather than throwing.
 */
export async function fetchCurrentContact(): Promise<AuthenticatedContact | null> {
  const store = await cookies();
  const token = store.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) {
    return null;
  }
  try {
    const response = await fetch(`${getApiBaseUrl()}/portal/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as AuthenticatedContact;
  } catch {
    return null;
  }
}
