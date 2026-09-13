import { redirect } from "next/navigation";

/**
 * Finalization pass — the Agent Workspace's locale root.
 *
 * This was an orphaned Story-02 scaffolding placeholder: a static heading
 * plus two hand-written links, unauthenticated, and unlinked from anywhere
 * in the app (every in-app link is locale-prefixed to a real screen; a
 * grep for a bare `/${locale}` href across `apps/web/src` returns nothing).
 * `README.md` points at `http://localhost:3000` as "the Agent Workspace",
 * so landing on that placeholder was the one route that contradicted its
 * own documentation.
 *
 * `apps/portal` had the identical placeholder at the identical path and
 * fixed it in Story 96 by redirecting to its real entry point; this is
 * that same fix, applied to the app that never received it. Deleting the
 * file outright is not the alternative — it is the only `page.tsx` at this
 * exact `/${locale}` segment, so removing it would 404 `/en` and `/ar`
 * with no fallback.
 *
 * `/tickets` is the target because it is already the app's real entry
 * point: `(auth)/login/page.tsx` pushes there on a successful sign-in.
 *
 * No auth logic is introduced or duplicated here. An unauthenticated
 * visitor redirected to `/${locale}/tickets` is bounced on to
 * `/${locale}/login` by that route's own existing `(agent)/layout.tsx`
 * server-side guard — the single place this app decides who may see the
 * workspace. There is no loop: `/login` lives in the `(auth)` group, which
 * this redirect never targets and that guard never protects.
 */
export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/tickets`);
}
