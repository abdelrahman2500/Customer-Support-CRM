import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { fetchCurrentContact } from "@/lib/auth-server";
import { fetchBranding } from "@/lib/branding-server";
import { PortalHeader } from "@/components/portal/portal-header";
import { PortalNotifications } from "@/components/portal/portal-notifications";
import { SuccessToaster } from "@/components/portal/success-toaster";
import { SessionGuard } from "@/components/providers/session-guard";

/**
 * Story 52 — the real auth guard for the Customer Portal, mirroring
 * `apps/web`'s `(agent)/layout.tsx` exactly: every route under `(customer)/`
 * renders behind this layout, and an unauthenticated (or expired-token)
 * visitor is redirected to `login` server-side, before any content renders.
 *
 * Story 86 — mounts `PortalNotifications` alongside `PortalHeader`, the
 * same way `(agent)/layout.tsx` mounts `BranchNotifications` alongside
 * `WorkspaceNav`: exactly once per authenticated session, not per-page.
 */
export default async function CustomerLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Story 229 — branding is read in the same request, so the header's
  // first paint already carries the logo and brand colour.
  const [contact, branding] = await Promise.all([fetchCurrentContact(), fetchBranding()]);
  if (!contact) {
    redirect(`/${locale}/login`);
  }
  const t = await getTranslations("common");

  return (
    <div className="flex min-h-screen flex-col bg-surface-sunk">
      {/* A11Y-3 — first focusable element on every route here, so Tab from
          the top of the page reaches it before the header/nav below. */}
      <a href="#main-content" className="skip-link">
        {t("skipToMainContent")}
      </a>
      {/* Final UX pass — see apps/web's (agent)/layout.tsx. */}
      <SessionGuard subject={contact.id}>
        <PortalHeader contact={contact} initialBranding={branding} />
        <PortalNotifications customerId={contact.customerId} />
        {/* Story 229 — one reading-width column, shared with the header's
          own inner row so the brand, the nav and the content line up. */}
        <main id="main-content" className="flex-1 px-page-x py-page-y">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
        {/* Story 94 — one generic success-feedback renderer for the whole
          authenticated session; deliberately separate from
          PortalNotifications' real-time domain-event stack. */}
        <SuccessToaster />
      </SessionGuard>
    </div>
  );
}
