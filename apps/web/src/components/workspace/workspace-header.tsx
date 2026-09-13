"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Fragment, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import type { AuthenticatedUser } from "@crm/shared";
import { useNavigatingRouter as useRouter } from "@/hooks/use-navigating-router";
import { useMyBranchMembershipsQuery } from "@/hooks/use-branch-memberships";
import { useMentionNotifications } from "@/hooks/use-mention-notifications";
import { useRealtimeConnectionIssue } from "@/lib/realtime-connection";
import { useErrorMessage } from "@/hooks/use-error-message";
import {
  Alert,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  MenuIcon,
} from "@crm/ui";
import { clearAccessToken, logout, switchBranch, updatePreferredLocale } from "@/lib/api";
import { clearQueryCache } from "@/lib/query-client-registry";
import type { BrandingSummary } from "@/lib/branding-api";
import { NAV_GROUPS, NavItemLabel, isNavItemActive } from "./nav-items";

/** Story 119 — `apps/web/src/i18n/routing.ts`'s own configured locales. */
const LOCALES = ["en", "ar"] as const;

/** Swaps the leading `/{locale}` segment of `pathname` for `targetLocale`
 * — a plain string operation, mirroring this codebase's own "no
 * `next-intl/navigation` helper anywhere" convention (confirmed by grep
 * while authoring this story). Falls back to just `/{targetLocale}` if
 * `pathname` doesn't start with the expected segment (should not happen
 * in practice — every route here is locale-prefixed). */
function buildLocalePath(pathname: string, currentLocale: string, targetLocale: string): string {
  const prefix = `/${currentLocale}`;
  if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
    return `/${targetLocale}${pathname.slice(prefix.length)}`;
  }
  return `/${targetLocale}`;
}

/**
 * Story 129 — the part of the old `WorkspaceNav` that is identical in both
 * navigation presentations: the brand block, "signed in as", the branch
 * switcher, the language switcher, sign-out, the realtime-connection
 * banner, and the RM-11 hamburger menu (below `sm`, where neither desktop
 * presentation renders at all — so one hamburger genuinely serves both).
 * Everything here moved over unchanged from `workspace-nav.tsx`; see
 * `nav-items.tsx`'s doc comment for the accumulated record of why each
 * piece behaves the way it does.
 *
 * Two deliberate differences from the old file:
 *
 * 1. `branding` arrives as a prop. `WorkspaceShell` owns the single
 *    `useBrandingQuery()` call for the whole shell, so the header, the
 *    navbar and the sidebar cannot each open their own query and cannot
 *    disagree about the answer.
 * 2. Story 129's `appName` override, below.
 */
export function WorkspaceHeader({
  user,
  branding,
  unreadCount,
  unreadCountKnown,
}: {
  user: AuthenticatedUser;
  branding: BrandingSummary | undefined;
  unreadCount: number;
  unreadCountKnown: boolean;
}) {
  const t = useTranslations("workspace");
  const router = useRouter();
  const pathname = usePathname();
  const { locale } = useParams<{ locale: string }>();
  // RM-06 — mounted here (rather than a single page) since this component
  // is rendered on every agent-workspace page, mirroring how its own
  // unread-count badge already needs to stay live regardless of which
  // screen is open.
  useMentionNotifications(user.id);
  // Batch 7 (UX audit) — the shared realtime connection's status; no
  // realtime hook anywhere previously surfaced a dropped connection to the
  // user at all (silence, indistinguishable from "nothing happened yet").
  const connectionIssue = useRealtimeConnectionIssue();
  const membershipsQuery = useMyBranchMembershipsQuery();
  const memberships = membershipsQuery.data ?? [];
  const errorMessage = useErrorMessage();
  const [branchSwitchError, setBranchSwitchError] = useState<string | null>(null);

  /** Story 129 — a branch's configured application name replaces the
   * hard-coded `workspace.appName` i18n string wherever the app prints
   * its own name. `?.trim() ||`, never `??`: an `appName` of `"   "` must
   * fall back to the translated default exactly like an absent one, and
   * `??` would print a blank brand block instead. */
  const brandName = branding?.appName?.trim() || t("appName");

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

  /**
   * Story 118 — `value` encodes both `branchId`/`departmentId` (a
   * membership is unique on the pair, not `branchId` alone) as
   * `"branchId::departmentId-or-empty"` — plain `<select>` values are
   * always single strings.
   *
   * Unlike `handleSignOut`/`handleSwitchLocale` below, `switchBranch(...)`
   * is not a secondary side effect of some other action that should
   * proceed regardless — it *is* the action the user asked for. A
   * rejection here (a stale membership, a network blip) must not
   * silently clear the cache/refresh as if it had succeeded: that would
   * leave the session on the branch it was already on while looking like
   * nothing happened. On failure this sets a visible message instead and
   * returns without touching the cache/route; the `<select>` itself
   * already reverts to the still-active membership on the next render,
   * since its `value` is derived from `memberships`, not from whatever
   * the browser's native dropdown shows mid-interaction.
   */
  async function handleSwitchBranch(value: string) {
    const [branchId, departmentId] = value.split("::");
    if (!branchId) {
      return;
    }
    setBranchSwitchError(null);
    try {
      await switchBranch(branchId, departmentId || undefined);
    } catch (error) {
      setBranchSwitchError(
        errorMessage(error, {
          forbidden: t("branchSwitcher.actionForbidden"),
          generic: t("branchSwitcher.actionFailed"),
        }),
      );
      return;
    }
    clearQueryCache();
    router.refresh();
  }

  /** Story 119 — best-effort persist (a failed `PATCH` never blocks the
   * actual language switch, mirroring `handleSignOut`'s own `logout()`
   * try/catch for a non-critical side effect), then a plain
   * `router.push()` into the new locale — no token/cache implications,
   * unlike `handleSwitchBranch` above. */
  async function handleSwitchLocale(targetLocale: string) {
    if (targetLocale === locale) {
      return;
    }
    try {
      await updatePreferredLocale(targetLocale as "en" | "ar");
    } catch {
      // Best-effort — the language switch below always proceeds regardless.
    }
    router.push(buildLocalePath(pathname ?? `/${locale}`, locale, targetLocale));
  }

  return (
    <>
      <header
        style={{ "--brand-primary": branding?.primaryColor ?? undefined } as CSSProperties}
        className="flex items-center justify-between border-b-2 border-[var(--brand-primary,rgb(var(--rule)))] bg-surface px-6 py-3"
      >
        {branding?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={branding.logoUrl} alt={brandName} className="h-8 w-auto" />
        ) : (
          <Link
            href={`/${locale}/tickets`}
            // `truncate` — Story 129's `appName` is free text capped at 60
            // characters, which is still long enough to push the header's
            // controls off-screen on a narrow viewport if left unbounded.
            className="truncate text-sm font-semibold text-ink-strong"
          >
            {brandName}
          </Link>
        )}
        <div className="flex items-center gap-4 text-sm text-ink-muted">
          <span>{t("signedInAs", { name: user.fullName })}</span>
          {memberships.length > 1 && (
            <select
              aria-label={t("branchSwitcher.label")}
              className="h-8 rounded-md border border-rule-strong bg-surface px-2 text-sm"
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
          {branchSwitchError && (
            <span role="alert" className="text-danger-solid">
              {branchSwitchError}
            </span>
          )}
          <select
            aria-label={t("languageSwitcher.label")}
            className="h-8 rounded-md border border-rule-strong bg-surface px-2 text-sm"
            value={locale}
            onChange={(event) => void handleSwitchLocale(event.target.value)}
          >
            {LOCALES.map((localeOption) => (
              <option key={localeOption} value={localeOption}>
                {t(`languageSwitcher.options.${localeOption}`)}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            {t("signOut")}
          </Button>
        </div>
      </header>
      {/* Batch 7 (UX audit) — a non-destructive banner while the shared
          realtime connection is down after having been up (see
          `useRealtimeConnectionIssue`'s own doc comment for exactly which
          case that is). Live notifications/presence/ticket updates are
          simply not arriving right now; nothing here is destructive or
          blocks the rest of the page. */}
      {connectionIssue && (
        <Alert variant="default" className="rounded-none border-x-0 border-t-0 text-center text-xs">
          {t("realtimeReconnecting")}
        </Alert>
      )}
      {/* RM-11 — the hamburger toggle only, below `sm`. Story 129 — at `sm`
          and up the branch's chosen presentation (navbar or sidebar) takes
          over, and both of those are `hidden sm:flex`, so exactly one
          navigation surface is ever visible and this one hamburger serves
          both layouts. That is also why the sidebar rail can never occupy
          a phone's width. */}
      <div className="border-b border-rule bg-surface px-6 py-2 sm:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" aria-label={t("nav.menuLabel")}>
              <MenuIcon className="h-4 w-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {NAV_GROUPS.map((group, groupIndex) => (
              <Fragment key={group.groupKey}>
                {groupIndex > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel>{t(`nav.groups.${group.groupKey}`)}</DropdownMenuLabel>
                {group.items.map((item) => {
                  const href = `/${locale}/${item.href}`;
                  const isActive = isNavItemActive(pathname, href);
                  return (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link href={href} aria-current={isActive ? "page" : undefined}>
                        <NavItemLabel
                          item={item}
                          t={t}
                          unreadCount={unreadCount}
                          unreadCountKnown={unreadCountKnown}
                        />
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </Fragment>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}
