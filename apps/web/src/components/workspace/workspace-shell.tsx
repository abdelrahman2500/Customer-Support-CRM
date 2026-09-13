"use client";

import type { ReactNode } from "react";
import type { AuthenticatedUser } from "@crm/shared";
import { useBrandingQuery } from "@/hooks/use-branding";
import { useUnreadNotificationCountQuery } from "@/hooks/use-notifications";
import type { BrandingSummary } from "@/lib/branding-api";
import { resolveNavigationLayout } from "./nav-items";
import { WorkspaceHeader } from "./workspace-header";
import { WorkspaceNavbar } from "./workspace-navbar";
import { WorkspaceSidebar } from "./workspace-sidebar";

/**
 * Story 129 — the Agent Workspace's shell, and the one place the branch's
 * chosen navigation layout is resolved and applied. Applying it here
 * rather than per-page is what makes the choice consistent across every
 * `(agent)` route.
 *
 * `initialBranding` is what `(agent)/layout.tsx` already fetched
 * server-side (`fetchBranding()`), seeded into the query so the very first
 * client render already knows the layout. Without it the shell would paint
 * the navbar, resolve the query, and swap to the sidebar on every single
 * page load — the layout decides the page's own row-vs-column structure,
 * so that flash would be the whole page moving, not a detail.
 *
 * This is the ONLY branding query in the shell. `WorkspaceHeader`,
 * `WorkspaceNavbar` and `WorkspaceSidebar` receive what they need as
 * props, so the three cannot each open their own query, cannot disagree
 * about the answer, and cannot triple the request count.
 *
 * `children` is a plain `ReactNode` prop, which is what keeps the Server
 * Components `(agent)/layout.tsx` renders server-rendered: passing server
 * children through a client component is the supported App Router
 * pattern, and the alternative — importing the pages here — would turn
 * every `(agent)` route into a client component.
 *
 * When an admin changes the layout on their own screen,
 * `useUpdateBrandingMutation` invalidates `brandingQueryKey`, this query
 * re-renders, and the shell swaps presentation without a route change.
 * There is deliberately no realtime push for branding (Story 82 made the
 * same call): another open tab keeps its current layout until its next
 * natural refetch or navigation, consistent with every other
 * `useQuery`-backed value in this app.
 */
export function WorkspaceShell({
  user,
  initialBranding,
  children,
}: {
  user: AuthenticatedUser;
  initialBranding: BrandingSummary | null;
  children: ReactNode;
}) {
  const brandingQuery = useBrandingQuery(initialBranding ?? undefined);
  const unreadCountQuery = useUnreadNotificationCountQuery();
  const unreadCount = unreadCountQuery.data?.unreadCount ?? 0;
  const layout = resolveNavigationLayout(brandingQuery.data?.navigationLayout);

  const header = (
    <WorkspaceHeader
      user={user}
      branding={brandingQuery.data}
      unreadCount={unreadCount}
      unreadCountKnown={unreadCountQuery.isSuccess}
    />
  );

  /* NAV-2 — carried over verbatim from `(agent)/layout.tsx`, `id` and
     classes included. The `id` is what A11Y-3's skip link targets (the
     link itself stays outside this shell, still the first focusable
     element on the page), and `max-w-screen-2xl` is NAV-2's own width cap
     — every route here used to stretch full-bleed. Both variants render
     exactly this `<main>`; only where it sits relative to the navigation
     differs. */
  /* `min-w-0` is the one class added to the carried-over `<main>`, and the
     sidebar is why: a flex item's default `min-width: auto` refuses to
     shrink below its content's intrinsic width, so beside a `w-60` rail a
     wide table pushed the whole page wider than the viewport and produced
     a horizontal scrollbar at 1440px and below (measured). With `min-w-0`
     the column shrinks and the table scrolls inside its own
     `overflow-x-auto` box, which is exactly what NAV-2 assumed. Harmless
     in the navbar branch, where `<main>` is a flex *column* child and the
     cross-axis was never the constrained one. */
  const main = (
    <main id="main-content" className="min-w-0 flex-1 p-6">
      <div className="mx-auto w-full max-w-screen-2xl">{children}</div>
    </main>
  );

  if (layout === "SIDEBAR") {
    return (
      <>
        {header}
        {/* `min-h-0` — without it the flex row refuses to shrink below its
            content's height, and the rail's own `overflow-y-auto` never
            engages. */}
        <div className="flex min-h-0 flex-1">
          <WorkspaceSidebar
            unreadCount={unreadCount}
            unreadCountKnown={unreadCountQuery.isSuccess}
          />
          {main}
        </div>
      </>
    );
  }

  return (
    <>
      {header}
      <WorkspaceNavbar unreadCount={unreadCount} unreadCountKnown={unreadCountQuery.isSuccess} />
      {main}
    </>
  );
}
