"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAuthExpired } from "@/lib/auth-events";
import { clearQueryCache } from "@/lib/query-client-registry";

/**
 * Story 95 — Authentication Recovery. Mirrors
 * `apps/web/src/components/providers/auth-recovery-listener.tsx` exactly —
 * see that file's doc comment for the full rationale. Redirects to
 * `/${locale}/login?reason=session-expired`, caught by
 * `(customer)/layout.tsx`'s own server-side guard on the next render.
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
