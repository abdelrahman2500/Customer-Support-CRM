import { useQuery } from "@tanstack/react-query";
import { getBranding } from "@/lib/branding-api";

/** Story 82 — mirrors `apps/web/src/hooks/use-branding.ts`'s shape. */
export const brandingQueryKey = ["branding"] as const;

export function useBrandingQuery() {
  return useQuery({ queryKey: brandingQueryKey, queryFn: getBranding });
}
