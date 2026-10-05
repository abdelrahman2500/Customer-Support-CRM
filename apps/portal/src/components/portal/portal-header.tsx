"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useNavigatingRouter as useRouter } from "@/hooks/use-navigating-router";
import { useTranslations } from "next-intl";
import type { AuthenticatedContact } from "@crm/shared";
import { useBrandingQuery } from "@/hooks/use-branding";
import type { BrandingSummary } from "@/lib/branding-api";
import { useUnreadNotificationCountQuery } from "@/hooks/use-portal-notification-history";
import { clearAccessToken, logout, updatePreferredLocale } from "@/lib/api";
import { clearQueryCache } from "@/lib/query-client-registry";
import { useRealtimeConnectionIssue } from "@/lib/realtime-connection";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  MenuIcon,
  NativeSelect,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
  ThemeSwitcher,
  BrandScope,
  deriveBrandTokens,
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
 * Story 147 — gains a fifth, to `/account` (self-service password change).
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
export function PortalHeader({
  contact,
  initialBranding,
}: {
  contact: AuthenticatedContact;
  /** Story 229 — the server-read branding (`fetchBranding()`), or `null`. */
  initialBranding?: BrandingSummary | null;
}) {
  const t = useTranslations("home");
  const tTickets = useTranslations("tickets");
  const tKnowledgeBase = useTranslations("knowledgeBase");
  const tChat = useTranslations("chat");
  const tNotifications = useTranslations("notifications");
  const tAccount = useTranslations("account");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const { locale } = useParams<{ locale: string }>();
  const brandingQuery = useBrandingQuery(initialBranding ?? undefined);
  // Story 183 (RD-1.6) — the controlled branding model: Tier 1 brand edge
  // always, Tier 2 accent only when the derived colours pass their gates.
  // BrandScope also mirrors the variables onto <html>, so the whole page
  // (and portalled menus) picks them up, not just this header.
  const brandTokens = useMemo(
    () => deriveBrandTokens(brandingQuery.data?.primaryColor, brandingQuery.data?.secondaryColor),
    [brandingQuery.data?.primaryColor, brandingQuery.data?.secondaryColor],
  );
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

  const homeHref = `/${locale}/home`;
  const ticketsHref = `/${locale}/tickets`;
  const knowledgeBaseHref = `/${locale}/knowledge-base`;
  const chatHref = `/${locale}/chat`;
  const notificationsHref = `/${locale}/notifications`;
  const accountHref = `/${locale}/account`;
  const linkClassName = (href: string) =>
    `flex items-center gap-1.5 rounded-control px-2 py-1.5 text-ink-muted hover:bg-surface-muted hover:text-ink focus-ring ${
      isActiveHref(href) ? "bg-surface-muted font-medium text-ink" : ""
    }`;

  /** RM-11 — the one shared source for the nav's links, so the desktop
   * `<nav>` and the mobile `DropdownMenu` can never render different
   * content for the same item. */
  const navItems: Array<{
    href: string;
    label: string;
    /** Story 200 (RD-2.6, recon A11Y-11) — the link's whole accessible name
     * when it must say more than its label (the unread count); the visual
     * badge is then aria-hidden so it is not announced twice. */
    ariaLabel?: string;
    badge?: { count: number };
  }> = [
    // Story 200 (RD-2.6, recon PT-03) — an explicit Home item; the signed-in
    // name no longer doubles as the way home.
    { href: homeHref, label: t("nav.home") },
    { href: ticketsHref, label: tTickets("nav") },
    { href: knowledgeBaseHref, label: tKnowledgeBase("nav") },
    { href: chatHref, label: tChat("nav") },
    unreadCountQuery.isSuccess && unreadCount > 0
      ? {
          href: notificationsHref,
          label: tNotifications("nav"),
          ariaLabel: tNotifications("navUnread", { count: unreadCount }),
          badge: { count: unreadCount },
        }
      : { href: notificationsHref, label: tNotifications("nav") },
    { href: accountHref, label: tAccount("nav") },
  ];

  /** The visual unread badge — aria-hidden: the count lives in the link's name. */
  const unreadBadge = (item: (typeof navItems)[number]) =>
    item.badge && (
      <Badge variant="destructive" aria-hidden="true" className="tabular-nums">
        {item.badge.count}
      </Badge>
    );

  return (
    <BrandScope tokens={brandTokens}>
      {/* Story 200 (RD-2.6) — header v2, mirroring the agent header (Story
          195): one row of [hamburger below sm] [brand → home] [nav] … [user
          menu]. Language, theme and sign-out moved into the user menu, a
          Popover (it holds native selects); their handlers are unchanged. */}
      {/* Story 229 (PR-5.1) — the portal's lighter chrome: a white header
          with the brand stripe along its top, lifted off the canvas by a
          hairline shadow; its row shares the content's reading width. */}
      <header className="border-t-[3px] border-brand bg-surface px-page-x shadow-sm">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-2 py-3 sm:gap-4">
          {/* RM-11 — the hamburger; the flat `<nav>` takes over at `lg` (Story
              229 — six links no longer fit beside the brand at tablet width). */}
          <div className="lg:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon-sm" aria-label={t("nav.menuLabel")}>
                  <MenuIcon className="h-4 w-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {navItems.map((item) => (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link
                      href={item.href}
                      aria-label={item.ariaLabel}
                      aria-current={isActiveHref(item.href) ? "page" : undefined}
                    >
                      {item.label}
                      {unreadBadge(item)}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Recon PT-03/RS-06 — the brand links home, truncates (`min-w-0`)
              and carries a focus ring; a configured logo is capped below `sm`
              exactly like the agent header's (Story 173). */}
          <Link
            href={homeHref}
            className="focus-ring flex min-w-0 shrink items-center gap-2 rounded-inner"
          >
            {brandingQuery.data?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brandingQuery.data.logoUrl}
                alt={t("logoAlt")}
                className="h-8 w-auto max-w-32 rounded-inner bg-logo-plate object-contain p-0.5 sm:max-w-none"
              />
            ) : (
              <span className="truncate font-semibold text-ink">{tCommon("appName")}</span>
            )}
          </Link>

          <nav
            aria-label={t("nav.label")}
            className="hidden min-w-0 flex-1 flex-wrap items-center gap-1 text-sm lg:flex"
          >
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.ariaLabel}
                aria-current={isActiveHref(item.href) ? "page" : undefined}
                className={linkClassName(item.href)}
              >
                {item.label}
                {unreadBadge(item)}
              </Link>
            ))}
          </nav>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label={t("userMenu.trigger", { name: contact.fullName })}
                className="ms-auto min-w-0 shrink-0 gap-2 px-1 sm:px-2"
              >
                <Avatar name={contact.fullName} size="sm" decorative />
                <span className="hidden max-w-40 truncate sm:inline">{contact.fullName}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" aria-label={t("userMenu.label")} className="flex flex-col gap-3">
              <p className="min-w-0 truncate text-sm text-ink-muted">
                {t("signedInAs", { name: contact.fullName })}
              </p>
              {/* Story 182 (RD-1.5) — the shared NativeSelect and theme switcher. */}
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
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={handleSignOut}>
                {t("signOut")}
              </Button>
            </PopoverContent>
          </Popover>
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
    </BrandScope>
  );
}
