"use client";

import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { AuthenticatedUser } from "@crm/shared";
import { Button } from "@/components/ui/button";
import { clearAccessToken, logout } from "@/lib/api";

export function WorkspaceNav({ user }: { user: AuthenticatedUser }) {
  const t = useTranslations("workspace");
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();

  /**
   * Story 41 — calls the real `POST /auth/logout` (revoking the refresh
   * token server-side) before the existing local cleanup. `logout()` is
   * itself best-effort (it never throws), but the `catch` here is a second,
   * defense-in-depth guarantee at this call site: local cleanup — cookie
   * cleared, redirected — always runs, even if `logout()` were to reject,
   * so the user's intent to leave is never blocked on a round-trip.
   */
  async function handleSignOut() {
    try {
      await logout();
    } catch {
      // Best-effort — local sign-out below always proceeds regardless.
    }
    clearAccessToken();
    router.push(`/${locale}/login`);
  }

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <a href={`/${locale}/tickets`} className="text-sm font-semibold text-slate-900">
        {t("appName")}
      </a>
      <div className="flex items-center gap-4 text-sm text-slate-600">
        <span>{t("signedInAs", { name: user.fullName })}</span>
        <Button variant="outline" size="sm" onClick={handleSignOut}>
          {t("signOut")}
        </Button>
      </div>
    </header>
  );
}
