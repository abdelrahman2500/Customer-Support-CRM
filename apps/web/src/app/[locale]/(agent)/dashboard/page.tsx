import { redirect } from "next/navigation";
import { fetchCurrentUser } from "@/lib/auth-server";
import { DashboardView } from "@/components/dashboard/dashboard-view";

/**
 * Story 28 — replaces the Story 23 redirect stub (which itself replaced the
 * Story 02 wiring-proof placeholder) with a real dashboard: the agent's own
 * open tickets, ranked by SLA urgency. Resolves the authenticated user the
 * same way `(agent)/layout.tsx` already does (`fetchCurrentUser()`,
 * Story 28 — extracted from the layout's original inline `fetchMe()`) to
 * get the id `DashboardView` filters by. `(agent)/layout.tsx` already
 * guards every route under `(agent)/`, so `user` is expected to be
 * non-null here; the redirect below is a defensive mirror of that same
 * guard (e.g. a token expiring between the layout's check and this one),
 * not a new auth mechanism.
 */
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await fetchCurrentUser();
  if (!user) {
    redirect(`/${locale}/login`);
  }

  return <DashboardView userId={user.id} />;
}
