"use client";

import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { AuthenticatedUser } from "@crm/shared";
import { Button } from "@/components/ui/button";
import { clearAccessToken } from "@/lib/api";

export function WorkspaceNav({ user }: { user: AuthenticatedUser }) {
  const t = useTranslations("workspace");
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();

  function handleSignOut() {
    clearAccessToken();
    router.push(`/${locale}/login`);
  }

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <a href={`/${locale}/tickets`} className="text-sm font-semibold text-slate-900">
        {t("appName")}
      </a>
      <div className="flex items-center gap-4 text-sm text-slate-600">
        <span>{t("signedInAs", { name: user.fullName })}</span>
        <Button variant="outline" size="sm" onClick={handleSignOut}>
          {t("signOut")}
        </Button>
      </div>
    </header>
  );
}
