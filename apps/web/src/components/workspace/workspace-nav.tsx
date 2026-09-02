"use client";

import { useParams, usePathname, useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import type { AuthenticatedUser } from "@crm/shared";
import { useBrandingQuery } from "@/hooks/use-branding";
import { useMyBranchMembershipsQuery } from "@/hooks/use-branch-memberships";
import { useUnreadNotificationCountQuery } from "@/hooks/use-notifications";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { clearAccessToken, logout, switchBranch } from "@/lib/api";
import { clearQueryCache } from "@/lib/query-client-registry";

/**
 * Story 44 — the top-level Agent Workspace screens, in a fixed,
 * always-rendered order (day-to-day operational screens first, then
 * administrative/oversight screens). No client-side permission gating: no
 * such pattern exists anywhere in this codebase, and the seeded `Agent`
 * role has zero granted permissions today, so there is no real per-permission
 * signal to key visibility off — a screen the current session lacks
 * permission for renders its own existing 403/forbidden state after
 * navigation, exactly as it already does when reached by direct URL.
 *
 * Story 51 — `knowledge-base` appended as the new last entry, the same
 * append convention every prior addition to this list has used.
 *
 * Story 56 — `reports` appended as the new last entry, same convention.
 *
 * Story 57 — `automation-rules` appended as the new last entry, same
 * convention.
 *
 * Story 61 — `notification-templates` appended as the new last entry,
 * same convention.
 *
 * Story 62 — `branding` appended as the new last entry, same convention.
 *
 * Story 81 — `ai-settings` appended as the new last entry, same
 * convention.
 *
 * Story 82 — the header consumes `useBrandingQuery()` (Story 62's own
 * agent-facing query, unchanged): a configured logo replaces the plain
 * app-name text link, and `primaryColor` tints the header's own bottom
 * border via a CSS custom property + a Tailwind arbitrary-value class
 * with a literal fallback — an unconfigured branch (every branch today)
 * renders pixel-identical to before this story. See that story's own
 * plan, "Design decision", for why this is safe relative to
 * `docs/architecture/12-risks-tradeoffs-and-scope.md`'s RTL/i18n risk.
 *
 * Story 91 — `quick-replies` appended as the new last entry, same
 * convention.
 *
 * Story 92 — the `notifications` nav link gains an unread-count `Badge`
 * from `useUnreadNotificationCountQuery()`. Rendered only when the count
 * is a real, positive number; a loading or errored query (or a `0` count)
 * renders no badge at all — the link itself is never affected, mirroring
 * this codebase's own "a fetch hiccup never breaks the primary flow"
 * convention (e.g. `ChatComposer`'s quick-reply picker, Story 91).
 *
 * Story 118 — a branch switcher next to "signed in as", rendered only
 * when `useMyBranchMembershipsQuery()` returns more than one row — every
 * user before this story (and any user who has never been granted a
 * second membership) sees no new UI at all. Switching calls
 * `switchBranch` (a fresh access token + rotated refresh cookie), clears
 * every cached query (Story 95's existing helper — every branch-scoped
 * query is now stale for the new active branch), and `router.refresh()`s
 * — not a client-side `router.push()` — so this route's own server
 * components (`user`/`AuthenticatedUser` above is fetched server-side by
 * the parent layout, `fetchCurrentUser()`) actually re-render with the
 * new active branch too.
 */
const NAV_ITEMS = [
  { href: "dashboard", labelKey: "nav.dashboard" },
  { href: "tickets", labelKey: "nav.tickets" },
  { href: "customers", labelKey: "nav.customers" },
  { href: "sla-policies", labelKey: "nav.slaPolicies" },
  { href: "business-hours", labelKey: "nav.businessHours" },
  { href: "branches", labelKey: "nav.branches" },
  { href: "users", labelKey: "nav.users" },
  { href: "roles", labelKey: "nav.roles" },
  { href: "audit-logs", labelKey: "nav.auditLogs" },
  { href: "notifications", labelKey: "nav.notifications" },
  { href: "knowledge-base", labelKey: "nav.knowledgeBase" },
  { href: "reports", labelKey: "nav.reports" },
  { href: "automation-rules", labelKey: "nav.automationRules" },
  { href: "notification-templates", labelKey: "nav.notificationTemplates" },
  { href: "branding", labelKey: "nav.branding" },
  { href: "ai-settings", labelKey: "nav.aiSettings" },
  { href: "quick-replies", labelKey: "nav.quickReplies" },
] as const;

export function WorkspaceNav({ user }: { user: AuthenticatedUser }) {
  const t = useTranslations("workspace");
  const router = useRouter();
  const pathname = usePathname();
  const { locale } = useParams<{ locale: string }>();
  const brandingQuery = useBrandingQuery();
  const unreadCountQuery = useUnreadNotificationCountQuery();
  const unreadCount = unreadCountQuery.data?.unreadCount ?? 0;
  const membershipsQuery = useMyBranchMembershipsQuery();
  const memberships = membershipsQuery.data ?? [];

  /**
   * Story 41 — calls the real `POST /auth/logout` (revoking the refresh
   * token server-side) before the existing local cleanup. `logout()` is
   * itself best-effort (it never throws), but the `catch` here is a second,
   * defense-in-depth guarantee at this call site: local cleanup — cookie
   * cleared, redirected — always runs, even if `logout()` were to reject,
   * so the user's intent to leave is never blocked on a round-trip.
   *
   * Story 95 — also clears every cached query, so a different user signing
   * in next, in the same tab, never sees a flash of this session's cached
   * data before their own queries refetch.
   */
  async function handleSignOut() {
    try {
      await logout();
    } catch {
      // Best-effort — local sign-out below always proceeds regardless.
    }
    clearAccessToken();
    clearQueryCache();
    router.push(`/${locale}/login`);
  }

  /** Story 118 — `value` encodes both `branchId`/`departmentId` (a
   * membership is unique on the pair, not `branchId` alone) as
   * `"branchId::departmentId-or-empty"` — plain `<select>` values are
   * always single strings. */
  async function handleSwitchBranch(value: string) {
    const [branchId, departmentId] = value.split("::");
    if (!branchId) {
      return;
    }
    await switchBranch(branchId, departmentId || undefined);
    clearQueryCache();
    router.refresh();
  }

  return (
    <>
      <header
        style={{ "--brand-primary": brandingQuery.data?.primaryColor ?? undefined } as CSSProperties}
        className="flex items-center justify-between border-b-2 border-[var(--brand-primary,theme(colors.slate.200))] bg-white px-6 py-3"
      >
        {brandingQuery.data?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brandingQuery.data.logoUrl} alt={t("appName")} className="h-8 w-auto" />
        ) : (
          <a href={`/${locale}/tickets`} className="text-sm font-semibold text-slate-900">
            {t("appName")}
          </a>
        )}
        <div className="flex items-center gap-4 text-sm text-slate-600">
          <span>{t("signedInAs", { name: user.fullName })}</span>
          {memberships.length > 1 && (
            <select
              aria-label={t("branchSwitcher.label")}
              className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm"
              value={`${memberships.find((m) => m.isActive)?.branchId ?? ""}::${
                memberships.find((m) => m.isActive)?.departmentId ?? ""
              }`}
              onChange={(event) => void handleSwitchBranch(event.target.value)}
            >
              {memberships.map((membership) => (
                <option
                  key={`${membership.branchId}::${membership.departmentId ?? ""}`}
                  value={`${membership.branchId}::${membership.departmentId ?? ""}`}
                >
                  {membership.departmentId
                    ? t("branchSwitcher.branchAndDepartment", {
                        branch: membership.branchName,
                        department: membership.departmentName ?? "",
                      })
                    : membership.branchName}
                </option>
              ))}
            </select>
          )}
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            {t("signOut")}
          </Button>
        </div>
      </header>
      <nav
        aria-label={t("nav.label")}
        className="flex flex-wrap items-center gap-4 border-b border-slate-200 bg-white px-6 py-2 text-sm text-slate-600"
      >
        {NAV_ITEMS.map((item) => {
          const href = `/${locale}/${item.href}`;
          // Story 96 — Navigation & Route Robustness. A nested route (e.g.
          // `/en/tickets/ticket-1`) still marks its own top-level `Tickets`
          // link current, so it doesn't just match on exact equality.
          const isActive = pathname === href || pathname?.startsWith(`${href}/`);
          return (
            <a
              key={item.href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                isActive ? "bg-slate-100 font-medium text-slate-900" : ""
              }`}
            >
              {t(item.labelKey)}
              {item.href === "notifications" &&
                unreadCountQuery.isSuccess &&
                unreadCount > 0 && (
                  <Badge
                    variant="destructive"
                    aria-label={t("nav.unreadNotificationsLabel", { count: unreadCount })}
                  >
                    {unreadCount}
                  </Badge>
                )}
            </a>
          );
        })}
      </nav>
    </>
  );
}
