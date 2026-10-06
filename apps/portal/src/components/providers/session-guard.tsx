"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { accessTokenSubject } from "@/lib/session";

const subscribe = () => () => {};

/**
 * Final UX pass — the signed-in layout renders for one contact (`subject`).
 * If this tab's access token belongs to someone else, the layout is a stale
 * copy from an earlier session (another sign-in in this tab, or one in
 * another tab): nothing of it is shown, and the route is refreshed so the
 * server renders it for the token's own contact. `resetClientSession`
 * prevents this on every sign-in and sign-out in the app; this is the
 * guarantee that the next person never sees the previous one's data, even
 * on a path that skips it.
 */
export function SessionGuard({ subject, children }: { subject: string; children: ReactNode }) {
  const router = useRouter();
  // The server never renders a stale layout: its snapshot is "no token".
  const tokenSubject = useSyncExternalStore(subscribe, accessTokenSubject, () => null);
  const stale = tokenSubject !== null && tokenSubject !== subject;
  useEffect(() => {
    if (stale) router.refresh();
  }, [stale, router]);
  if (stale) return <div className="min-h-screen" aria-busy="true" />;
  return <>{children}</>;
}
