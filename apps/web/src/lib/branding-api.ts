import { apiFetch } from "./api";

/**
 * Story 62 — Administration — Branch Branding (Foundation). A dedicated API
 * client file, mirroring `automation-rules-api.ts`'s own "distinct domain,
 * own file" convention.
 *
 * Mirrors the backend's own `BrandingSummary`
 * (`apps/api/src/modules/admin/branding.service.ts`) exactly.
 */

/** Story 129 — mirrors the backend's `NavigationLayout` Prisma enum.
 * Declared locally rather than imported: `apps/web` has no dependency on
 * `@prisma/client` and must not gain one for two string literals. */
export type NavigationLayout = "SIDEBAR" | "NAVBAR";

export interface BrandingSummary {
  appName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  navigationLayout: NavigationLayout | null;
}

export interface UpdateBrandingInput {
  appName?: string;
  logoUrl?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  navigationLayout?: NavigationLayout;
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
