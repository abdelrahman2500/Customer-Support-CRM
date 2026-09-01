/**
 * Story 97 — Loading & Skeleton UX.
 *
 * Recon found the same `<div className="h-N w-full animate-pulse
 * rounded-md bg-slate-100" />` idiom hand-duplicated across 8+ portal
 * files. This extracts it into one shared primitive — mirroring
 * `apps/web/src/components/ui/skeleton.tsx` exactly (same `animate-pulse
 * rounded-md` shape, `bg-slate-100` instead of web's `bg-slate-200`,
 * matching portal's own existing shade) — placed alongside this app's
 * other shared, non-domain-specific components (`success-toaster.tsx`,
 * `portal-header.tsx`, `notification-toaster.tsx`), NOT under a `ui/`
 * directory: portal deliberately has none (Story 52's own convention,
 * reaffirmed by Story 94).
 */
export function Skeleton({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`animate-pulse rounded-md bg-slate-100 ${className}`.trim()} {...props} />
  );
}
