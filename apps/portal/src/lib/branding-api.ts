import { apiFetch } from "./api";

/**
 * Story 82 — Branding — Live Logo/Color Consumption. Mirrors the
 * backend's `BrandingSummary` (`apps/api/src/modules/admin/
 * branding.service.ts`) exactly, same independent per-app
 * re-declaration convention every other type in this app's
 * `lib/*-api.ts` files already follows. Read-only from the portal side
 * — `PATCH /branding` stays agent-only (Story 62), unchanged.
 */
export interface BrandingSummary {
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
}

/** `GET /portal/branding`. */
export function getBranding(): Promise<BrandingSummary> {
  return apiFetch<BrandingSummary>("/portal/branding");
}
