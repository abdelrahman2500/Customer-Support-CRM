"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import type { AuthenticatedContact } from "@crm/shared";
import { useBrandingQuery } from "@/hooks/use-branding";
import { useUnreadNotificationCountQuery } from "@/hooks/use-portal-notification-history";
import { clearAccessToken, logout, updatePreferredLocale } from "@/lib/api";
import { clearQueryCache } from "@/lib/query-client-registry";
import { useRealtimeConnectionIssue } from "@/lib/realtime-connection";
import {
  Alert,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  MenuIcon,
} from "@crm/ui";

/** Story 119 — mirrors `apps/web`'s own `WorkspaceNav` constants/helper
 * exactly; see that file's own doc comment. */
const LOCALES = ["en", "ar"] as const;

function buildLocalePath(pathname: string, currentLocale: string, targetLocale: string): string {
  const prefix = `/${currentLocale}`;
  if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
    return `/${targetLocale}${pathname.slice(prefix.length)}`;
  }
  return `/${targetLocale}`;
}

/**
 * Story 52 — the Customer Portal's minimal authenticated header, mirroring
 * `apps/web`'s `WorkspaceNav` sign-out logic exactly (real `POST
 * /portal/auth/logout` first, local cleanup always runs regardless).
 *
 * Story 53 — gains the portal's first real nav link, to `/tickets`.
 * Story 54 — gains a second, to `/knowledge-base`.
 * Story 80 — gains a third, to `/chat` (AI Portal Chatbot).
 * Story 89 — gains a fourth, to `/notifications` (Notification History).
 *
 * Story 82 — consumes `useBrandingQuery()` (`GET /portal/branding`):
 * a configured logo renders immediately before the existing
 * `signedInAs` link (never replacing it — unlike `WorkspaceNav`'s plain
 * app-name text, this link also conveys which Contact is signed in), and
 * `primaryColor` tints the header's own bottom border the same way
 * `WorkspaceNav` does. An unconfigured branch (every branch today)
 * renders pixel-identical to before this story.
 *
 * Story 92 — the `notifications` nav link gains an unread-count badge from
 * `useUnreadNotificationCountQuery()`, mirroring `WorkspaceNav`'s own
 * treatment exactly: rendered only for a real, positive count; a loading
 * or errored query (or a `0` count) renders no badge, and the link itself
 * is never affected.
 *
 * Story 96 — Navigation & Route Robustness. Recon confirmed this header's
 * `<nav>` had no `aria-label`, no active-route indication, undersized
 * touch targets, and — critically — no `flex-wrap` on either the header or
 * the nav, so it genuinely overflowed the viewport at mobile widths with no
 * visible scroll affordance. All four are fixed here, mirroring
 * `WorkspaceNav`'s own equivalent Story 96 treatment.
 *
 * RM-11 — Mobile-Responsive Navigation. Below `sm` the flat `<nav>` below
 * is hidden (`hidden sm:flex`, RM-10's own pure-CSS pattern) and a
 * hamburger `DropdownMenuTrigger` takes its place, opening the identical
 * links as `DropdownMenuItem` `asChild` `Link`s — mirroring
 * `WorkspaceNav`'s own identical RM-11 change, including its "one shared
 * `navItems` array feeds both lists" and "`DropdownMenuContent` only
 * mounts once opened, so the two link sets never coexist" reasoning.
 */
export function PortalHeader({ contact }: { contact: AuthenticatedContact }) {
  const t = useTranslations("home");
  const tTickets = useTranslations("tickets");
  const tKnowledgeBase = useTranslations("knowledgeBase");
  const tChat = useTranslations("chat");
  const tNotifications = useTranslations("notifications");
  const router = useRouter();
  const pathname = usePathname();
  const { locale } = useParams<{ locale: string }>();
  const brandingQuery = useBrandingQuery();
  const unreadCountQuery = useUnreadNotificationCountQuery();
  const unreadCount = unreadCountQuery.data?.unreadCount ?? 0;
  // Batch 7 (UX audit) — mirrors `WorkspaceNav`'s own connection banner;
  // see `useRealtimeConnectionIssue`'s doc comment for exactly which case
  // this is (an actual drop after being up, not routine idle/startup).
  const connectionIssue = useRealtimeConnectionIssue();

  // Story 95 — also clears every cached query; see WorkspaceNav's own
  // handleSignOut doc comment for why.
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

  /** Story 119 — mirrors `WorkspaceNav.handleSwitchLocale` exactly: a
   * best-effort persist (never blocks the actual switch), then a plain
   * `router.push()` into the new locale. */
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

  // Story 96 — Navigation & Route Robustness. A plain object keyed by
  // route (rather than four separate isActive expressions) so the active
  // check and the nested-route rule live in one place, mirroring
  // WorkspaceNav's own `isActive` treatment.
  function isActiveHref(href: string): boolean {
    return pathname === href || pathname?.startsWith(`${href}/`) === true;
  }

  const ticketsHref = `/${locale}/tickets`;
  const knowledgeBaseHref = `/${locale}/knowledge-base`;
  const chatHref = `/${locale}/chat`;
  const notificationsHref = `/${locale}/notifications`;
  const linkClassName = (href: string) =>
    `flex items-center gap-1.5 rounded-md px-2 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-ring ${
      isActiveHref(href) ? "bg-slate-100 font-medium text-slate-900" : ""
    }`;

  /** RM-11 — the one shared source for the nav's 4 links, so the desktop
   * `<nav>` and the mobile `DropdownMenu` can never render different
   * content for the same item. */
  const navItems: Array<{
    href: string;
    label: string;
    badge?: { count: number; ariaLabel: string };
  }> = [
    { href: ticketsHref, label: tTickets("nav") },
    { href: knowledgeBaseHref, label: tKnowledgeBase("nav") },
    { href: chatHref, label: tChat("nav") },
    {
      href: notificationsHref,
      label: tNotifications("nav"),
      badge:
        unreadCountQuery.isSuccess && unreadCount > 0
          ? {
              count: unreadCount,
              ariaLabel: tNotifications("unreadNotificationsLabel", { count: unreadCount }),
            }
          : undefined,
    },
  ];

  return (
    <>
      <header
        style={{ "--brand-primary": brandingQuery.data?.primaryColor ?? undefined } as CSSProperties}
        className="flex flex-wrap items-center justify-between gap-y-2 border-b-2 border-[var(--brand-primary,rgb(var(--rule)))] bg-surface px-6 py-3"
      >
        <div className="flex items-center gap-2">
          {brandingQuery.data?.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brandingQuery.data.logoUrl} alt={t("logoAlt")} className="h-8 w-auto" />
          )}
          <Link
            href={`/${locale}/home`}
            className="rounded-md px-2 py-1.5 font-semibold text-slate-900"
          >
            {t("signedInAs", { name: contact.fullName })}
          </Link>
          {/* RM-11 — the hamburger toggle only, below `sm`; the flat `<nav>`
              below takes over at `sm` and up. */}
          <div className="sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" aria-label={t("nav.menuLabel")}>
                  <MenuIcon className="h-4 w-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {navItems.map((item) => (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link href={item.href} aria-current={isActiveHref(item.href) ? "page" : undefined}>
                      {item.label}
                      {item.badge && (
                        <Badge variant="destructive" aria-label={item.badge.ariaLabel}>
                          {item.badge.count}
                        </Badge>
                      )}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <nav
            aria-label={t("nav.label")}
            className="hidden flex-wrap items-center gap-4 text-sm sm:flex"
          >
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActiveHref(item.href) ? "page" : undefined}
                className={linkClassName(item.href)}
              >
                {item.label}
                {item.badge && (
                  <Badge variant="destructive" aria-label={item.badge.ariaLabel}>
                    {item.badge.count}
                  </Badge>
                )}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <select
            aria-label={t("languageSwitcher.label")}
            className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
            value={locale}
            onChange={(event) => void handleSwitchLocale(event.target.value)}
          >
            {LOCALES.map((localeOption) => (
              <option key={localeOption} value={localeOption}>
                {t(`languageSwitcher.options.${localeOption}`)}
              </option>
            ))}
          </select>
          <Button type="button" onClick={handleSignOut} variant="outline" className="px-3">
            {t("signOut")}
          </Button>
        </div>
      </header>
      {/* Batch 7 (UX audit) — mirrors `WorkspaceNav`'s own connection
          banner. Non-destructive: live ticket updates/chat replies simply
          aren't arriving right now; nothing here blocks the rest of the
          page. */}
      {connectionIssue && (
        <Alert variant="default" className="rounded-none border-x-0 border-t-0 text-center text-xs">
          {t("realtimeReconnecting")}
        </Alert>
      )}
    </>
  );
}
