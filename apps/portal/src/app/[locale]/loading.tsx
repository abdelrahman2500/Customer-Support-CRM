import { RouteLoadingSkeleton } from "@crm/ui";

/**
 * UX audit — Login/navigation loading investigation. Mirrors
 * `apps/web/src/app/[locale]/loading.tsx` exactly. `(customer)/layout.tsx`
 * is an async Server Component (`fetchCurrentContact()` against
 * `GET /portal/auth/me`, then `getTranslations`) that renders before any of
 * its children, `PortalHeader` included. Next's `loading.tsx` convention
 * wraps a segment's `children` in `<Suspense>` — it never wraps that same
 * segment's own `layout.tsx` body — so every per-route `loading.tsx` added
 * under `(customer)/**` sits *inside* the very layout that blocks and could
 * never cover this gap: entering the portal for the first time (right after
 * login, or a fresh URL/reload) rendered nothing at all for the full
 * auth-init round trip.
 *
 * This file lives one level up, in `[locale]/`, so its `<Suspense>` wraps
 * `[locale]/layout.tsx`'s `children` — i.e. `(customer)/layout.tsx` itself.
 * It only fires on that first mount (or a hard reload); ordinary navigation
 * between already-mounted child routes never remounts the layout, so this
 * never flashes over the transitions the existing per-route `loading.tsx`
 * files already cover. Reuses the same shared `RouteLoadingSkeleton` those
 * files already render — no second loading system.
 */
export default function Loading() {
  return <RouteLoadingSkeleton />;
}
