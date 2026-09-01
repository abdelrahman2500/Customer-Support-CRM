"use client";

import { useParams, usePathname, useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import type { AuthenticatedContact } from "@crm/shared";
import { useBrandingQuery } from "@/hooks/use-branding";
import { useUnreadNotificationCountQuery } from "@/hooks/use-portal-notification-history";
import { clearAccessToken, logout } from "@/lib/api";
import { clearQueryCache } from "@/lib/query-client-registry";

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
    `flex items-center gap-1.5 rounded-md px-2 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
      isActiveHref(href) ? "bg-slate-100 font-medium text-slate-900" : ""
    }`;

  return (
    <header
      style={{ "--brand-primary": brandingQuery.data?.primaryColor ?? undefined } as CSSProperties}
      className="flex flex-wrap items-center justify-between gap-y-2 border-b-2 border-[var(--brand-primary,theme(colors.slate.200))] bg-white px-6 py-3"
    >
      <nav aria-label={t("nav.label")} className="flex flex-wrap items-center gap-4 text-sm">
        {brandingQuery.data?.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brandingQuery.data.logoUrl} alt={t("logoAlt")} className="h-8 w-auto" />
        )}
        <a href={`/${locale}/home`} className="rounded-md px-2 py-1.5 font-semibold text-slate-900">
          {t("signedInAs", { name: contact.fullName })}
        </a>
        <a href={ticketsHref} aria-current={isActiveHref(ticketsHref) ? "page" : undefined} className={linkClassName(ticketsHref)}>
          {tTickets("nav")}
        </a>
        <a
          href={knowledgeBaseHref}
          aria-current={isActiveHref(knowledgeBaseHref) ? "page" : undefined}
          className={linkClassName(knowledgeBaseHref)}
        >
          {tKnowledgeBase("nav")}
        </a>
        <a href={chatHref} aria-current={isActiveHref(chatHref) ? "page" : undefined} className={linkClassName(chatHref)}>
          {tChat("nav")}
        </a>
        <a
          href={notificationsHref}
          aria-current={isActiveHref(notificationsHref) ? "page" : undefined}
          className={linkClassName(notificationsHref)}
        >
          {tNotifications("nav")}
          {unreadCountQuery.isSuccess && unreadCount > 0 && (
            <span
              aria-label={tNotifications("unreadNotificationsLabel", { count: unreadCount })}
              className="inline-flex items-center rounded-full border border-transparent bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800"
            >
              {unreadCount}
            </span>
          )}
        </a>
      </nav>
      <button
        type="button"
        onClick={handleSignOut}
        className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
      >
        {t("signOut")}
      </button>
    </header>
  );
}
