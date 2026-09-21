import { PortalHomeView } from "@/components/portal/portal-home-view";

/**
 * Story 52 — the Customer Portal's first authenticated page, reached only
 * through the real `(customer)/layout.tsx` SSR auth guard.
 *
 * Story 136 — the Story 52/53 placeholder body (one sentence under a key
 * literally named `home.placeholder`, plus a single link) is replaced by a
 * real landing page. This file becomes the same thin server page every other
 * portal route already is (`tickets/page.tsx`, `knowledge-base/page.tsx`,
 * `notifications/page.tsx`, `chat/page.tsx`): home was the lone `async`
 * server-component exception, and the data the page now shows comes from
 * client-side React Query hooks, so the content moves into a client view.
 * `loading.tsx` is unchanged and still renders the shared
 * `RouteLoadingSkeleton`.
 */
export default function PortalHomePage() {
  return <PortalHomeView />;
}
