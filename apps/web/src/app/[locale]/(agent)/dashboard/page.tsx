import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import type { AuthenticatedUser } from "@crm/shared";
import { ACCESS_TOKEN_COOKIE, getApiBaseUrl } from "@/lib/api";

/**
 * Placeholder route proving the frontend-to-`apps/api` auth wiring end to
 * end — see Story 02's plan (`.squad/plans/project-foundation/02-story-monorepo-scaffolding.md`).
 * Not a finished dashboard: a real agent workspace is a future story.
 */
async function fetchMe(): Promise<AuthenticatedUser | null> {
  const store = await cookies();
  const token = store.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) {
    return null;
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as AuthenticatedUser;
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const t = await getTranslations("common");
  const me = await fetchMe();

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">{t("appName")}</h1>
      <p className="mt-2">{me ? t("signedInAs", { email: me.email }) : t("notSignedIn")}</p>
      {!me && (
        <a className="ms-0 mt-4 inline-block text-blue-600 underline" href="../login">
          {t("login")}
        </a>
      )}
    </main>
  );
}
