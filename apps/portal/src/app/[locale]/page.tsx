import { redirect } from "next/navigation";

/**
 * Story 96 — Navigation & Route Robustness.
 *
 * Recon (Story 95) confirmed this was an orphaned Story-02 placeholder page:
 * unauthenticated, unlinked from anywhere in the app (`PortalHeader`'s
 * `signedInAs` link, and every other in-app link, already points to
 * `/${locale}/home`, never bare `/${locale}`), and the only `page.tsx` at
 * this exact `/${locale}` segment — deleting it outright would 404
 * `/en`/`/ar` with no fallback.
 *
 * Redirects to the real landing page instead. An unauthenticated visitor is
 * then bounced on to `/login` by that page's own existing
 * `(customer)/layout.tsx` server-side guard — no new guard logic
 * introduced here, per this story's own scope.
 */
export default async function PortalRootPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/home`);
}
