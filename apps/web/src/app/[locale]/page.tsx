import { getTranslations } from "next-intl/server";

export default async function HomePage() {
  const t = await getTranslations("common");

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">{t("appName")}</h1>
      <p className="mt-2">
        <a className="text-blue-600 underline" href="dashboard">
          Dashboard
        </a>{" "}
        ·{" "}
        <a className="text-blue-600 underline" href="login">
          {t("login")}
        </a>
      </p>
    </main>
  );
}
