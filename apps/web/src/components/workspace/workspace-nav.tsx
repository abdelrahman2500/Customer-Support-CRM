"use client";

import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { AuthenticatedUser } from "@crm/shared";
import { Button } from "@/components/ui/button";
import { clearAccessToken, logout } from "@/lib/api";

/**
 * Story 44 — the nine existing top-level Agent Workspace screens, in a
 * fixed, always-rendered order (day-to-day operational screens first, then
 * administrative/oversight screens). No client-side permission gating: no
 * such pattern exists anywhere in this codebase, and the seeded `Agent`
 * role has zero granted permissions today, so there is no real per-permission
 * signal to key visibility off — a screen the current session lacks
 * permission for renders its own existing 403/forbidden state after
 * navigation, exactly as it already does when reached by direct URL.
 */
const NAV_ITEMS = [
  { href: "dashboard", labelKey: "nav.dashboard" },
  { href: "tickets", labelKey: "nav.tickets" },
  { href: "customers", labelKey: "nav.customers" },
  { href: "sla-policies", labelKey: "nav.slaPolicies" },
  { href: "business-hours", labelKey: "nav.businessHours" },
  { href: "users", labelKey: "nav.users" },
  { href: "roles", labelKey: "nav.roles" },
  { href: "audit-logs", labelKey: "nav.auditLogs" },
  { href: "notifications", labelKey: "nav.notifications" },
] as const;

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
    <>
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
      <nav
        aria-label={t("nav.label")}
        className="flex flex-wrap items-center gap-4 border-b border-slate-200 bg-white px-6 py-2 text-sm text-slate-600"
      >
        {NAV_ITEMS.map((item) => (
          <a
            key={item.href}
            href={`/${locale}/${item.href}`}
            className="hover:text-slate-900 hover:underline"
          >
            {t(item.labelKey)}
          </a>
        ))}
      </nav>
    </>
  );
}
