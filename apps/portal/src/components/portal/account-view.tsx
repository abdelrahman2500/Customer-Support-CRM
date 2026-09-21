"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@crm/ui";
import { ChangePasswordSection } from "./change-password-section";

/**
 * Story 147 — the portal's Account screen.
 *
 * A dedicated route rather than a section bolted onto an existing page:
 * `apps/web` already groups its personal-account screens under an
 * `account` nav group, and the portal's only other candidate surfaces
 * were `/home` (an overview dashboard) and `/notifications` (whose
 * preferences card is about notifications, not the account). A customer
 * looking for their password will look for "Account", not for either of
 * those.
 *
 * It holds one section today. It is deliberately shaped as a page that
 * composes sections — mirroring `NotificationHistoryView`'s own
 * composition — because the portal's remaining self-service gaps
 * (profile details, notification email address) land here next.
 */
export function AccountView() {
  const t = useTranslations("account");

  return (
    <section className="flex flex-col gap-4">
      <PageHeader title={t("title")} description={t("description")} />
      <ChangePasswordSection />
    </section>
  );
}
