import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AuthenticatedUser } from "@crm/shared";
import { ACCESS_TOKEN_COOKIE, getApiBaseUrl } from "@/lib/api";
import { WorkspaceNav } from "@/components/workspace/workspace-nav";
import { BranchNotifications } from "@/components/notifications/branch-notifications";

/**
 * Story 23 — the real auth guard for the agent workspace, replacing the
 * Story 02 dashboard placeholder's inline, unguarded `fetchMe()`. Every
 * route under `(agent)/` renders behind this layout: an unauthenticated (or
 * expired-token) visitor is redirected to `login` server-side, before any
 * workspace content renders. Reuses the exact SSR `GET /auth/me` call the
 * Story 02 placeholder already made — no new auth mechanism.
 */
async function fetchMe(): Promise<AuthenticatedUser | null> {
  const store = await cookies();
  const token = store.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) {
    return null;
  }
  try {
    const response = await fetch(`${getApiBaseUrl()}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as AuthenticatedUser;
  } catch {
    return null;
  }
}

export default async function AgentWorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await fetchMe();
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
