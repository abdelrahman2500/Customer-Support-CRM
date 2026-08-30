import { apiFetch } from "./api";

/**
 * Story 62 — Administration — Branch Branding (Foundation). A dedicated API
 * client file, mirroring `automation-rules-api.ts`'s own "distinct domain,
 * own file" convention.
 *
 * Mirrors the backend's own `BrandingSummary`
 * (`apps/api/src/modules/admin/branding.service.ts`) exactly.
 */
export interface BrandingSummary {
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
}

export interface UpdateBrandingInput {
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

export function getBranding(): Promise<BrandingSummary> {
  return apiFetch<BrandingSummary>("/branding");
}

export function updateBranding(input: UpdateBrandingInput): Promise<BrandingSummary> {
  return apiFetch<BrandingSummary>("/branding", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
