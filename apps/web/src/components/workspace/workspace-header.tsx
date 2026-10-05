"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { AuthenticatedUser } from "@crm/shared";
import { useNavigatingRouter as useRouter } from "@/hooks/use-navigating-router";
import { useMyBranchMembershipsQuery } from "@/hooks/use-branch-memberships";
import { useMentionNotifications } from "@/hooks/use-mention-notifications";
import { useRealtimeConnectionIssue } from "@/lib/realtime-connection";
import { useErrorMessage } from "@/hooks/use-error-message";
import {
  AddIcon,
  Alert,
  Avatar,
  Badge,
  Button,
  MenuIcon,
  NativeSelect,
  NotificationsIcon,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  ThemeSwitcher,
  recipes,
} from "@crm/ui";
import { clearAccessToken, logout, switchBranch, updatePreferredLocale } from "@/lib/api";
import { clearQueryCache } from "@/lib/query-client-registry";
import type { BrandingSummary } from "@/lib/branding-api";
import { RailNav } from "./workspace-sidebar";

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
 *
 * Story 195 (RD-2.1) — header v2: one row of [hamburger below sm] [brand] …
 * [New ticket] [notifications bell] [user menu]. The identity, branch
 * switcher, language, theme, My sessions, Settings and Sign out moved into
 * the user menu; their behaviour (the handlers below) is unchanged. The menu
 * is a Popover, not a DropdownMenu: it holds native selects, and a Radix
 * menu's roving focus and typeahead would capture their keys. The hamburger
 * joined the header row instead of a third stacked bar (recon NAV-04), and
 * the bell's accessible name carries the unread count (A11Y-11).
 *
 * Story 213 (PR-2.1, visual language v2) — the header is the ink chrome band
 * (with the sidebar rail, it frames the light canvas); the Tier 1 brand edge
 * stays along its bottom. Below `sm` the hamburger opens a drawer (`Sheet`
 * from the reading side) holding the same grouped navigation as the rail,
 * instead of a long dropdown menu; it closes when a route is chosen.
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

  // Story 213 — the mobile drawer closes once a new route renders.
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => setDrawerOpen(false), [pathname]);

  const activeMembership = memberships.find((m) => m.isActive);
  const hasUnread = unreadCountKnown && unreadCount > 0;

  return (
    <>
      <header
        className={`${recipes.chrome} flex items-center gap-2 border-b-2 border-brand px-4 py-3 sm:gap-3 sm:px-6`}
      >
        {/* RM-11 — the hamburger, below `sm` only. Story 129 — at `sm` and up
            the branch's chosen presentation (navbar or sidebar) takes over,
            and both are `hidden sm:flex`, so exactly one navigation surface
            is ever visible. Story 195 — moved into the header row (NAV-04). */}
        <div className="sm:hidden">
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <Button variant="chrome" size="icon-sm" aria-label={t("nav.menuLabel")}>
                <MenuIcon className="h-4 w-4" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="start"
              size="sm"
              closeLabel={t("nav.closeMenu")}
              aria-describedby={undefined}
              className={`${recipes.chrome} border-chrome-rule`}
            >
              <SheetHeader className="border-chrome-rule">
                <SheetTitle className="text-subhead text-chrome-ink">
                  {t("nav.menuLabel")}
                </SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto py-3">
                <RailNav
                  unreadCount={unreadCount}
                  unreadCountKnown={unreadCountKnown}
                  onNavigate={() => setDrawerOpen(false)}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* `min-w-0` — the brand is the one elastic item in the row. */}
        <div className="flex min-w-0 flex-1 items-center">
          {branding?.logoUrl ? (
            // `max-w-32 … sm:max-w-none` — a configured logo is unbounded free
            // content, the same hazard the text brand below already guards with
            // `truncate`. Capped only below `sm`, so the natural desktop
            // presentation is untouched.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logoUrl}
              alt={brandName}
              className="h-8 w-auto max-w-32 rounded-inner bg-logo-plate object-contain p-0.5 sm:max-w-none"
            />
          ) : (
            <Link
              href={`/${locale}/tickets`}
              // `truncate` — Story 129's `appName` is free text capped at 60
              // characters, long enough to push the header's controls
              // off-screen on a narrow viewport if left unbounded.
              className="focus-ring min-w-0 truncate rounded-inner text-sm font-semibold text-chrome-ink"
            >
              {brandName}
            </Link>
          )}
        </div>

        {/* New ticket — the primary action on every page. Icon-only below
            `sm` (its label stays the accessible name via `sr-only`). */}
        <Button asChild size="sm" className="w-8 shrink-0 px-0 sm:w-auto sm:px-3">
          <Link href={`/${locale}/tickets/new`}>
            <AddIcon className="h-4 w-4" aria-hidden />
            <span className="sr-only sm:not-sr-only">{t("header.newTicket")}</span>
          </Link>
        </Button>

        {/* The count is part of the link's accessible name; the visual badge
            is aria-hidden so it is not announced twice (A11Y-11). */}
        <Button asChild variant="chrome" size="icon-sm" className="relative shrink-0">
          <Link
            href={`/${locale}/notifications`}
            aria-label={
              hasUnread
                ? t("header.notificationsUnread", { count: unreadCount })
                : t("header.notifications")
            }
          >
            <NotificationsIcon className="h-4 w-4" aria-hidden />
            {hasUnread && (
              <Badge
                variant="destructive"
                size="sm"
                aria-hidden="true"
                className="absolute -end-1 -top-1 min-w-4 justify-center px-1 tabular-nums"
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </Badge>
            )}
          </Link>
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="chrome"
              size="sm"
              aria-label={t("userMenu.trigger", { name: user.fullName })}
              className="min-w-0 shrink-0 gap-2 px-1 sm:px-2"
            >
              <Avatar name={user.fullName} size="sm" decorative />
              <span className="hidden max-w-40 truncate sm:inline">{user.fullName}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            aria-label={t("userMenu.label")}
            className="flex flex-col gap-3"
          >
            {/* `min-w-0` and `truncate` together: the identity is the one
                elastic line in the menu. */}
            <p className="min-w-0 truncate text-sm text-ink-muted">
              {t("signedInAs", { name: user.fullName })}
            </p>
            {memberships.length > 1 && (
              // Story 182 (RD-1.5) — the shared NativeSelect.
              <NativeSelect
                aria-label={t("branchSwitcher.label")}
                className="w-full"
                value={`${activeMembership?.branchId ?? ""}::${activeMembership?.departmentId ?? ""}`}
                onValueChange={(value) => void handleSwitchBranch(value)}
                options={memberships.map((membership) => ({
                  value: `${membership.branchId}::${membership.departmentId ?? ""}`,
                  label: membership.departmentId
                    ? t("branchSwitcher.branchAndDepartment", {
                        branch: membership.branchName,
                        department: membership.departmentName ?? "",
                      })
                    : membership.branchName,
                }))}
              />
            )}
            {branchSwitchError && (
              <span role="alert" className="text-sm text-danger-foreground">
                {branchSwitchError}
              </span>
            )}
            <NativeSelect
              aria-label={t("languageSwitcher.label")}
              className="w-full"
              value={locale}
              onValueChange={(value) => void handleSwitchLocale(value)}
              options={LOCALES.map((localeOption) => ({
                value: localeOption,
                label: t(`languageSwitcher.options.${localeOption}`),
              }))}
            />
            <ThemeSwitcher
              label={t("themeSwitcher.label")}
              className="w-full"
              optionLabels={{
                system: t("themeSwitcher.options.system"),
                light: t("themeSwitcher.options.light"),
                dark: t("themeSwitcher.options.dark"),
              }}
            />
            <Separator />
            <div className="flex flex-col">
              {(["my-sessions", "settings"] as const).map((href) => (
                <Link
                  key={href}
                  href={`/${locale}/${href}`}
                  className="focus-ring rounded-inner px-2 py-1.5 text-sm text-ink hover:bg-surface-muted"
                >
                  {t(href === "settings" ? "nav.settings" : "nav.mySessions")}
                </Link>
              ))}
            </div>
            <Separator />
            <Button variant="outline" size="sm" className="w-full" onClick={handleSignOut}>
              {t("signOut")}
            </Button>
          </PopoverContent>
        </Popover>
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
    </>
  );
}
