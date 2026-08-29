"use client";

import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { AuthenticatedContact } from "@crm/shared";
import { clearAccessToken, logout } from "@/lib/api";

/**
 * Story 52 — the Customer Portal's minimal authenticated header, mirroring
 * `apps/web`'s `WorkspaceNav` sign-out logic exactly (real `POST
 * /portal/auth/logout` first, local cleanup always runs regardless), trimmed
 * to what a single-page portal foundation needs — no nav links yet (no
 * other portal screen exists until a future story).
 */
export function PortalHeader({ contact }: { contact: AuthenticatedContact }) {
  const t = useTranslations("home");
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();

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
      <span className="text-sm font-semibold text-slate-900">
        {t("signedInAs", { name: contact.fullName })}
      </span>
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
