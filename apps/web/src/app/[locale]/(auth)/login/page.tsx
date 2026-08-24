"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ACCESS_TOKEN_COOKIE, getApiBaseUrl } from "@/lib/api";

/**
 * Deliberately unstyled — this proves the login → access-token → SSR
 * `/auth/me` wiring for Story 02, it is not the agent app's real sign-in
 * screen (a future story owns that).
 *
 * The access token is kept in a plain (non-httpOnly) cookie so the
 * dashboard's Server Component can read it via `next/headers` and forward
 * it to `apps/api`. The refresh token stays httpOnly, set directly by
 * `apps/api` on the API's own origin — this page never touches it.
 */
export default function LoginPage() {
  const t = useTranslations("common");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    const response = await fetch(`${getApiBaseUrl()}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // lets the API's Set-Cookie (refresh token) land
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      setError("Login failed");
      return;
    }

    const { accessToken } = (await response.json()) as { accessToken: string };
    document.cookie = `${ACCESS_TOKEN_COOKIE}=${accessToken}; path=/; max-age=900; samesite=lax`;
    router.push("../dashboard");
  }

  return (
    <main className="max-w-xs p-8">
      <h1 className="text-2xl font-semibold">{t("login")}</h1>
      <form className="mt-4 flex flex-col gap-3" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1">
          {t("email")}
          <input
            className="rounded border px-2 py-1"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          {t("password")}
          <input
            className="rounded border px-2 py-1"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button className="mt-2 rounded bg-blue-600 px-3 py-1.5 text-white" type="submit">
          {t("login")}
        </button>
      </form>
      {error && (
        <p className="mt-3 text-red-600" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}
