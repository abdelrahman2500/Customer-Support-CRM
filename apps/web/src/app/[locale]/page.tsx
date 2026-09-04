import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

export default async function HomePage() {
  const t = await getTranslations("common");
  /**
   * Story S-6 — the two links below were relative (`href="dashboard"`),
   * which a browser resolves against the *current* path by replacing its
   * last segment: from `/en` that produces `/dashboard`, dropping the
   * locale entirely and landing on a route that does not exist. They are
   * now absolute and locale-prefixed, like every other internal link in
   * this app, and go through `next/link` so they no longer reload the
   * document.
   */
  const locale = await getLocale();

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">{t("appName")}</h1>
      <p className="mt-2">
        <Link className="text-blue-600 underline" href={`/${locale}/dashboard`}>
          Dashboard
        </Link>{" "}
        ·{" "}
        <Link className="text-blue-600 underline" href={`/${locale}/login`}>
          {t("login")}
        </Link>
      </p>
    </main>
  );
}
