"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, EmptyState, NoAccessIcon } from "@crm/ui";

/**
 * Final UX pass — what a page the signed-in role cannot open shows instead
 * of itself: a calm explanation and a way back, not an error. Rendered by
 * `WorkspaceShell` (see `routeRequirements`), so no page of the kind ever
 * mounts, and no request it would make is sent.
 */
export function NoAccessState() {
  const t = useTranslations("workspace.noAccess");
  const { locale } = useParams<{ locale: string }>();
  return (
    <EmptyState
      icon={<NoAccessIcon className="h-6 w-6" />}
      title={t("title")}
      description={t("description")}
      action={
        <Button asChild size="sm">
          <Link href={`/${locale}/tickets`}>{t("back")}</Link>
        </Button>
      }
      className="mx-auto mt-8 max-w-lg"
    />
  );
}
