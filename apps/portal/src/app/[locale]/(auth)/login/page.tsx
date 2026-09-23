"use client";

import { useState, type FormEvent } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Alert, Button, Card, FormField, Input } from "@crm/ui";
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
 *
 * Story 168 — the redesign, applied here exactly as in `apps/web`'s own
 * login page: `Card` (raised, with a decorative accent rail), `FormField`,
 * `Button size="lg" isLoading`, the Story 134 token vocabulary and its
 * named type scale, and a pre-auth locale switcher reusing Story 119's
 * `home.languageSwitcher` keys. The session-expired state, previously a
 * hand-rolled `<p>`, is now the same `Alert` the web app uses — which also
 * makes it a `role="status"` live region rather than silent text. Identity
 * comes from `common.appName` ("Customer Portal"), which is the whole of
 * what distinguishes this screen from the agent one: no logo asset, no
 * branding endpoint, no new translation key.
 *
 * Deliberately still `next/navigation`'s `useRouter`, not a portal
 * `useNavigatingRouter`: `apps/web`'s hook depends on
 * `notifyNavigationStart`, which this app's own
 * `navigation-overlay-listener.tsx` does not export — it still detects
 * navigation by patching `history.pushState`/`replaceState`, the mechanism
 * `apps/web`'s listener documents as measured non-functional. Porting that
 * redesign is portal-wide infrastructure work, not a Login change. The
 * feedback this screen actually shows — the submit button held pending past
 * `push` until unmount — is identical in both apps and is preserved below.
 *
 * Nothing about authentication moved: same `POST /portal/auth/login`, same
 * `credentials: "include"`, same `setAccessToken`, same `/{locale}/home`
 * destination, same two error paths.
 */

/** Story 119's own list, restated here rather than imported: `portal-header.tsx`
 * keeps it module-private and this screen must not depend on an authenticated
 * component. Same source of truth — `apps/portal/src/i18n/routing.ts`. */
const LOCALES = ["en", "ar"] as const;

export default function LoginPage() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const tHome = useTranslations("home");
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const searchParams = useSearchParams();
  const sessionExpired = searchParams.get("reason") === "session-expired";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /**
   * Story 168 — the pre-auth locale switch. Deliberately NOT
   * `portal-header.tsx`'s `handleSwitchLocale`: that one calls
   * `updatePreferredLocale(...)` first, which is an authenticated request and
   * would 401 here. Nobody is signed in on this screen, so there is no
   * preference to persist — the route change alone is the whole behaviour.
   *
   * The query string is carried across so Story 95's
   * `?reason=session-expired` banner survives a language change.
   */
  function handleSwitchLocale(targetLocale: string): void {
    if (targetLocale === locale) {
      return;
    }
    const query = searchParams.toString();
    router.push(`/${targetLocale}/login${query ? `?${query}` : ""}`);
  }

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
        setSubmitting(false);
        return;
      }

      const { accessToken } = (await response.json()) as { accessToken: string };
      setAccessToken(accessToken);
      router.push(`/${locale}/home`);
      // UX audit — deliberately no `setSubmitting(false)` here. Mirrors
      // apps/web's own login page fix: the destination route's layout does
      // a server-side auth-init round trip (`fetchCurrentContact()` in
      // `(customer)/layout.tsx`) before it can render anything, and
      // `router.push` doesn't wait for that to resolve. Resetting
      // `submitting` immediately used to flip this button back to its idle
      // "Sign in" state while the still-visible login page sat frozen for
      // that entire round trip. Leaving `submitting` true keeps the button
      // disabled/pending until this component unmounts (real navigation)
      // or an error path below explicitly clears it.
    } catch {
      setError(t("loginFailed"));
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-surface-sunk px-surface py-shell sm:px-shell">
      {/* The locale switcher sits on the page, not inside the panel: it is a
          property of how you read this screen, not a field you fill in.
          `justify-end` is logical, so it lands on the correct edge in both
          directions without a single `ml-*`/`mr-*`. */}
      <div className="flex justify-end">
        <select
          aria-label={tHome("languageSwitcher.label")}
          className="focus-ring h-9 rounded-surface border border-rule-strong bg-surface px-2 text-sm text-ink"
          value={locale}
          onChange={(event) => handleSwitchLocale(event.target.value)}
        >
          {LOCALES.map((localeOption) => (
            <option key={localeOption} value={localeOption}>
              {tHome(`languageSwitcher.options.${localeOption}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-sm">
          {/* Identity block, outside the panel. Two steps of one hierarchy:
              which product this is, then what you are doing in it. */}
          <div className="mb-stack flex flex-col gap-tight text-center">
            <span className="text-sm font-medium text-ink-muted">{tCommon("appName")}</span>
            <h1 className="text-title text-ink">{t("title")}</h1>
          </div>

          <Card elevation="raised" className="overflow-hidden">
            {/* The one piece of deliberate product chrome on this screen.
                Decorative and `aria-hidden`; it carries no information and is
                not reachable. `bg-accent` is the existing primary token, so a
                future branding colour repoints it with no edit here. */}
            <div aria-hidden className="h-1 w-full bg-accent" />
            <div className="flex flex-col gap-stack p-surface sm:p-shell">
              {sessionExpired && !error && <Alert>{tCommon("errors.unauthorized")}</Alert>}
              <form className="flex flex-col gap-stack" onSubmit={handleSubmit}>
                <FormField density="comfortable" label={t("email")}>
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    autoComplete="email"
                    autoFocus
                  />
                </FormField>
                <FormField density="comfortable" label={t("password")}>
                  <Input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    autoComplete="current-password"
                  />
                </FormField>
                {error && <Alert variant="destructive">{error}</Alert>}
                <Button
                  type="submit"
                  size="lg"
                  isLoading={submitting}
                  /* `isLoading` renders the label inside `<span class="invisible">`,
                   * and `visibility: hidden` content is excluded from the accessible
                   * name computation — so in a real browser this button would lose
                   * its name for the whole pending window. jsdom does not model that
                   * (no Tailwind CSS is loaded), so no test can catch it; this names
                   * the button explicitly for exactly that window, using the string
                   * it already displays. No new key. */
                  aria-label={submitting ? t("signingIn") : undefined}
                >
                  {submitting ? t("signingIn") : t("signIn")}
                </Button>
              </form>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
