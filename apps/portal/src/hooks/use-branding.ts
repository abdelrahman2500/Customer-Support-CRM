import { useQuery } from "@tanstack/react-query";
import { getBranding, type BrandingSummary } from "@/lib/branding-api";

/** Story 82 — mirrors `apps/web/src/hooks/use-branding.ts`'s shape. */
export const brandingQueryKey = ["branding"] as const;

/** Story 229 — `initialData` is the branding `(customer)/layout.tsx`
 * already read server-side (`fetchBranding()`). */
export function useBrandingQuery(initialData?: BrandingSummary) {
  return useQuery({ queryKey: brandingQueryKey, queryFn: getBranding, initialData });
}
