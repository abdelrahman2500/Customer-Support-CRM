import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { fetchCurrentUser } from "@/lib/auth-server";
import { WorkspaceNav } from "@/components/workspace/workspace-nav";
import { BranchNotifications } from "@/components/notifications/branch-notifications";

/**
 * Story 23 — the real auth guard for the agent workspace, replacing the
 * Story 02 dashboard placeholder's inline, unguarded `fetchMe()`. Every
 * route under `(agent)/` renders behind this layout: an unauthenticated (or
 * expired-token) visitor is redirected to `login` server-side, before any
 * workspace content renders. Reuses the exact SSR `GET /auth/me` call the
 * Story 02 placeholder already made — no new auth mechanism.
 *
 * Story 28 — the `fetchMe()` implementation itself moved verbatim to
 * `@/lib/auth-server`'s `fetchCurrentUser()` so the new dashboard page can
 * resolve the same authenticated user server-side without a second,
 * independently-drifting "who am I" implementation. Behavior here is
 * unchanged.
 */
export default async function AgentWorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await fetchCurrentUser();
  if (!user) {
    redirect(`/${locale}/login`);
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <WorkspaceNav user={user} />
      <main className="flex-1 p-6">{children}</main>
      {/* Story 24 — one branch-wide notification consumer for the whole
          authenticated session, not per-page (see BranchNotifications). */}
      <BranchNotifications branchId={user.branchId} />
    </div>
  );
}
