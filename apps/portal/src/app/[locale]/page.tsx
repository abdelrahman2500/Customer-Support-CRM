import { getTranslations } from "next-intl/server";

/**
 * Placeholder page proving `apps/portal` is a distinct Next.js app from
 * `apps/web` (see docs/architecture/02-system-architecture-overview.md).
 * No portal auth or ticket flow yet — that's a future story.
 */
export default async function PortalHomePage() {
  const t = await getTranslations("common");

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">{t("appName")}</h1>
      <p className="mt-2 max-w-prose">{t("placeholder")}</p>
    </main>
  );
}
