"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAuthExpired } from "@/lib/auth-events";
import { clearQueryCache } from "@/lib/query-client-registry";

/**
 * Story 95 — Authentication Recovery.
 *
 * Recon confirmed that when a session becomes genuinely unrecoverable
 * (`apiFetch` fires `emitAuthExpired()` — see `@/lib/auth-events`), nothing
 * previously redirected the user: the already-mounted protected shell kept
 * rendering, showing only that one query/mutation's own local error state,
 * until the user happened to trigger a fresh navigation and the server-side
 * layout guard (`(agent)/layout.tsx`) finally caught it.
 *
 * This subscribes once and forces the recovery itself: clears every cached
 * query (so a subsequent sign-in never flashes this session's stale data —
 * the same fix applied to the explicit sign-out path in `WorkspaceNav`),
 * then replaces the current history entry with `/login?reason=session-expired`
 * so the back button doesn't return to the now-broken protected page. A
 * `replace`, not a `push`, for that same reason.
 *
 * Mounted once by `QueryProvider`, above every route group, so it fires
 * regardless of which page's request happened to surface the failure.
 */
export function AuthRecoveryListener() {
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();

  useEffect(() => {
    return onAuthExpired(() => {
      clearQueryCache();
      router.replace(`/${locale}/login?reason=session-expired`);
    });
  }, [router, locale]);

  return null;
}
