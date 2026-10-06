import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getBranding, updateBranding } from "@/lib/branding-api";
import type { BrandingSummary, UpdateBrandingInput } from "@/lib/branding-api";

/**
 * Story 62 — dedicated branding hooks, mirroring `use-automation-rules.ts`'s
 * own file/convention.
 */
export const brandingQueryKey = ["branding"] as const;

/**
 * Story 129 — `initialData` is optional so `WorkspaceShell` can seed this
 * query with the branding its own server component already fetched
 * (`fetchBranding()`), without changing a single existing call site.
 * Seeding matters because the navigation layout decides the shell itself:
 * without it, every page load would paint the navbar and then swap to the
 * sidebar once the query resolved.
 *
 * With `initialData` supplied, `isLoading` is `false` and `data` is
 * defined on the very first render. `BrandingView` is the only consumer
 * that branches on `isLoading`, and it never passes `initialData`, so its
 * loading skeleton is unchanged.
 */
export function useBrandingQuery(
  initialData?: BrandingSummary,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: brandingQueryKey,
    queryFn: getBranding,
    initialData,
    // Demo hardening — `WorkspaceShell` turns this off for a user without
    // `branding:read`, whose request would only 403 on every page.
    enabled: options.enabled ?? true,
  });
}

export function useUpdateBrandingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateBrandingInput) => updateBranding(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: brandingQueryKey });
    },
  });
}
