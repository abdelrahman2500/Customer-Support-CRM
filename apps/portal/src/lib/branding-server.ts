import { cookies } from "next/headers";
import { ACCESS_TOKEN_COOKIE, getApiBaseUrl } from "@/lib/api";
import type { BrandingSummary } from "@/lib/branding-api";

/**
 * Story 229 (PR-5.1) — mirrors `apps/web/src/lib/branding-server.ts`: the
 * branch's branding read server-side in the same request as
 * `fetchCurrentContact()`, and seeded into `useBrandingQuery` so the first
 * paint already has the logo and brand colour (no swap from the app name to
 * the logo, no stripe changing colour). `null` on any failure: the header
 * then renders exactly as an unconfigured branch does.
 */
export async function fetchBranding(): Promise<BrandingSummary | null> {
  const store = await cookies();
  const token = store.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) {
    return null;
  }
  try {
    const response = await fetch(`${getApiBaseUrl()}/portal/branding`, {
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
