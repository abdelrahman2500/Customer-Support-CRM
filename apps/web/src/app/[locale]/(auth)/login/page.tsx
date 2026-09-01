"use client";

import { useState, type FormEvent } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { getApiBaseUrl, setAccessToken } from "@/lib/api";

/**
 * Story 23 — the real agent sign-in screen, replacing the Story 02
 * wiring-proof placeholder ("not the agent app's real sign-in screen — a
 * future story owns that"). Same `/auth/login` request, same non-httpOnly
 * access-token cookie (Story 02's own design decision, unchanged — the
 * refresh token stays httpOnly, set directly by `apps/api`), same
 * `credentials: "include"` so that Set-Cookie lands. No new auth
 * mechanism, customer-portal login, or second JWT/session system.
 *
 * Story 41 — writes the cookie via `setAccessToken` (factored out of this
 * page's own former inline `document.cookie = ...`) rather than duplicating
 * that cookie-string construction a second time now that the silent-refresh
 * success path also needs to write it. Same cookie, same shape, no behavior
 * change.
 *
 * Story 95 — Authentication Recovery. `AuthRecoveryListener` redirects here
 * with `?reason=session-expired` after a confirmed-unrecoverable auth
 * failure elsewhere in the app; this renders a neutral, non-error banner
 * explaining why the visitor landed here rather than leaving them to guess.
 * Reuses `common.errors.unauthorized` — the exact copy Story 94 already
 * gives every `useErrorMessage()` caller for a 401 — rather than adding a
 * second, near-duplicate string. A real login failure (wrong credentials)
 * takes priority and replaces this banner once the user actually submits.
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
      const response = await fetch(`${getApiBaseUrl()}/auth/login`, {
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
      router.push(`/${locale}/tickets`);
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
        {sessionExpired && !error && <Alert className="mt-4">{tCommon("errors.unauthorized")}</Alert>}
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
          {error && <Alert variant="destructive">{error}</Alert>}
          <Button type="submit" disabled={submitting}>
            {submitting ? t("signingIn") : t("signIn")}
          </Button>
        </form>
      </div>
    </main>
  );
}
