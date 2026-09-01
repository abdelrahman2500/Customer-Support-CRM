"use client";

import { useParams, useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import type { AuthenticatedContact } from "@crm/shared";
import { useBrandingQuery } from "@/hooks/use-branding";
import { clearAccessToken, logout } from "@/lib/api";

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
 */
export function PortalHeader({ contact }: { contact: AuthenticatedContact }) {
  const t = useTranslations("home");
  const tTickets = useTranslations("tickets");
  const tKnowledgeBase = useTranslations("knowledgeBase");
  const tChat = useTranslations("chat");
  const tNotifications = useTranslations("notifications");
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const brandingQuery = useBrandingQuery();

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
    <header
      style={{ "--brand-primary": brandingQuery.data?.primaryColor ?? undefined } as CSSProperties}
      className="flex items-center justify-between border-b-2 border-[var(--brand-primary,theme(colors.slate.200))] bg-white px-6 py-3"
    >
      <nav className="flex items-center gap-4 text-sm">
        {brandingQuery.data?.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brandingQuery.data.logoUrl} alt={t("logoAlt")} className="h-8 w-auto" />
        )}
        <a href={`/${locale}/home`} className="font-semibold text-slate-900">
          {t("signedInAs", { name: contact.fullName })}
        </a>
        <a href={`/${locale}/tickets`} className="text-slate-600 hover:text-slate-900 hover:underline">
          {tTickets("nav")}
        </a>
        <a
          href={`/${locale}/knowledge-base`}
          className="text-slate-600 hover:text-slate-900 hover:underline"
        >
          {tKnowledgeBase("nav")}
        </a>
        <a href={`/${locale}/chat`} className="text-slate-600 hover:text-slate-900 hover:underline">
          {tChat("nav")}
        </a>
        <a
          href={`/${locale}/notifications`}
          className="text-slate-600 hover:text-slate-900 hover:underline"
        >
          {tNotifications("nav")}
        </a>
      </nav>
      <button
        type="button"
        onClick={handleSignOut}
        className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        {t("signOut")}
      </button>
    </header>
  );
}
