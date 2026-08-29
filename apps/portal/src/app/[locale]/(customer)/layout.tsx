import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { fetchCurrentContact } from "@/lib/auth-server";
import { PortalHeader } from "@/components/portal/portal-header";

/**
 * Story 52 — the real auth guard for the Customer Portal, mirroring
 * `apps/web`'s `(agent)/layout.tsx` exactly: every route under `(customer)/`
 * renders behind this layout, and an unauthenticated (or expired-token)
 * visitor is redirected to `login` server-side, before any content renders.
 */
export default async function CustomerLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const contact = await fetchCurrentContact();
  if (!contact) {
    redirect(`/${locale}/login`);
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <PortalHeader contact={contact} />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
