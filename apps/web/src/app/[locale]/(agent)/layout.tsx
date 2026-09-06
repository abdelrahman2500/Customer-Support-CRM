import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { fetchCurrentUser } from "@/lib/auth-server";
import { WorkspaceNav } from "@/components/workspace/workspace-nav";
import { BranchNotifications } from "@/components/notifications/branch-notifications";
import { SuccessToaster } from "@/components/ui/success-toaster";

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
  const t = await getTranslations("common");

  return (
    <div className="flex min-h-screen flex-col bg-surface-sunk">
      {/* A11Y-3 — first focusable element on every route here, so Tab from
          the top of the page reaches it before the nav below. */}
      <a href="#main-content" className="skip-link">
        {t("skipToMainContent")}
      </a>
      <WorkspaceNav user={user} />
      {/* NAV-2 — every route here used to stretch full-bleed with no width
          ceiling, the one inconsistency left once auth/error pages'
          existing `max-w-*`/`mx-auto` wrappers are accounted for. The
          shared `Table` primitive already wraps every table in its own
          `overflow-x-auto` box (`packages/ui/src/components/table.tsx`),
          so a wide table scrolls inside that box rather than depending on
          this `<main>` being edge-to-edge — capping the width here does
          not newly clip anything. `max-w-screen-2xl` (96rem/1536px) is
          generous enough for this app's widest tables while still reading
          as an intentional page rather than raw viewport width on an
          ultra-wide monitor. */}
      <main id="main-content" className="flex-1 p-6">
        <div className="mx-auto w-full max-w-screen-2xl">{children}</div>
      </main>
      {/* Story 24 — one branch-wide notification consumer for the whole
          authenticated session, not per-page (see BranchNotifications). */}
      <BranchNotifications branchId={user.branchId} />
      {/* Story 94 — one generic success-feedback renderer for the whole
          authenticated session; deliberately separate from
          BranchNotifications' domain-event stack (see SuccessToaster's own
          doc comment). */}
      <SuccessToaster />
    </div>
  );
}
