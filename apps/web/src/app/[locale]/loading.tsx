import { RouteLoadingSkeleton } from "@crm/ui";

/**
 * UX audit — Login/navigation loading investigation. `(agent)/layout.tsx`
 * is an async Server Component (`fetchCurrentUser()` against `GET /auth/me`,
 * then `getTranslations`) that renders *before* any of its children,
 * `WorkspaceNav` included. Next's `loading.tsx` convention wraps a segment's
 * `children` in `<Suspense>` — it never wraps that same segment's own
 * `layout.tsx` body. So every per-route `loading.tsx` added under
 * `(agent)/**` (dashboard, tickets, etc.) sits *inside* the very layout that
 * blocks, and none of them could ever cover this gap: entering the agent
 * workspace for the first time (right after login, or a fresh URL/reload)
 * rendered nothing at all — not even a skeleton — for the full auth-init
 * round trip, on top of `/login` itself just having reverted its button
 * before the redirect. See `apps/web/src/app/[locale]/(auth)/login/page.tsx`
 * for the other half of that fix.
 *
 * This file lives one level up, in `[locale]/`, so its `<Suspense>` wraps
 * `[locale]/layout.tsx`'s `children` — i.e. `(agent)/layout.tsx` itself.
 * That's the one boundary that can actually catch the auth-guard's blocking
 * fetch. It only fires on that first mount (or a hard reload): once
 * `AgentWorkspaceLayout` is mounted, ordinary navigation between its child
 * routes never remounts it, so this never flashes over list⇄detail/tab
 * transitions that the existing per-route `loading.tsx` files already cover.
 * Reuses the same shared `RouteLoadingSkeleton` those files already render —
 * no second loading system.
 */
export default function Loading() {
  return <RouteLoadingSkeleton />;
}
