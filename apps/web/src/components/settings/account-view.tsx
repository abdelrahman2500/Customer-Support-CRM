"use client";

import { useTranslations } from "next-intl";
import {
  Avatar,
  Badge,
  DescriptionItem,
  DescriptionList,
  LoadingStatus,
  PageHeader,
  SectionCard,
  Skeleton,
} from "@crm/ui";
import { useCurrentUserQuery } from "@/hooks/use-tickets";
import { MySessionsView } from "./my-sessions-view";
import { ChangePasswordSection } from "./change-password-section";

/**
 * Story 224 (PR-4.3) — one "Account" area: who you are signed in as, where
 * you are signed in, and your password — instead of a sessions page with a
 * password form tacked on underneath. Same requests as before (`/auth/me`,
 * the sessions list, the password change).
 */
export function AccountView() {
  const t = useTranslations("account");
  const tCommon = useTranslations("common");
  const me = useCurrentUserQuery();

  return (
    <section className="flex flex-col gap-section">
      <PageHeader title={t("title")} description={t("description")} />

      <SectionCard title={t("profileHeading")}>
        {me.isLoading && (
          <LoadingStatus label={tCommon("loading")} asChild>
            <Skeleton className="mt-3 h-16 w-full" />
          </LoadingStatus>
        )}
        {me.data && (
          <div className="mt-3 flex flex-wrap items-start gap-4">
            <Avatar name={me.data.fullName} size="lg" decorative />
            <DescriptionList columns={2} className="min-w-0 flex-1">
              <DescriptionItem term={t("name")}>{me.data.fullName}</DescriptionItem>
              <DescriptionItem term={t("email")}>
                <span dir="ltr">{me.data.email}</span>
              </DescriptionItem>
              <DescriptionItem term={t("roles")}>
                <span className="flex flex-wrap gap-1">
                  {me.data.roles.length > 0
                    ? me.data.roles.map((role) => (
                        <Badge key={role} variant="secondary" size="sm">
                          {role}
                        </Badge>
                      ))
                    : "—"}
                </span>
              </DescriptionItem>
            </DescriptionList>
          </div>
        )}
      </SectionCard>

      <MySessionsView hosted />
      <ChangePasswordSection />
    </section>
  );
}
