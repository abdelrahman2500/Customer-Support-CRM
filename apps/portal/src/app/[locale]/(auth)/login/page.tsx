"use client";

import { useState, type FormEvent } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Input } from "@crm/ui";
import { getApiBaseUrl, setAccessToken } from "@/lib/api";

/**
 * Story 52 — the Customer Portal's real sign-in screen, mirroring
 * `apps/web`'s `(auth)/login/page.tsx` file-for-file: same non-httpOnly
 * access-token cookie design (the refresh token stays httpOnly, set
 * directly by `apps/api`), same `credentials: "include"` so `Set-Cookie`
 * lands. Calls `POST /portal/auth/login`, not `/auth/login` — an entirely
 * separate cookie/session from any agent workspace session in the same
 * browser.
 *
 * Story 95 - Authentication Recovery. Mirrors apps/web's own login page:
 * AuthRecoveryListener redirects here with ?reason=session-expired after a
 * confirmed-unrecoverable auth failure elsewhere in the app; this renders a
 * neutral, non-error banner reusing common.errors.unauthorized (the exact
 * copy Story 94 already gives every useErrorMessage() caller for a 401). A
 * real login failure takes priority and replaces it.
 */
export default function LoginPage() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const searchParams = useSearchParams();
  const sessionExpired = searchParams.get("reason") === "session-expired";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch(`${getApiBaseUrl()}/portal/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        setError(t("loginFailed"));
        return;
      }

      const { accessToken } = (await response.json()) as { accessToken: string };
      setAccessToken(accessToken);
      router.push(`/${locale}/home`);
    } catch {
      setError(t("loginFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-8">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">{t("title")}</h1>
        {sessionExpired && !error && (
          <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {tCommon("errors.unauthorized")}
          </p>
        )}
        <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            {t("email")}
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            {t("password")}
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <Button type="submit" disabled={submitting}>
            {submitting ? t("signingIn") : t("signIn")}
          </Button>
        </form>
      </div>
    </main>
  );
}
