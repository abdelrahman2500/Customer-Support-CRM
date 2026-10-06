"use client";

import { useState, type FormEvent } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useNavigatingRouter as useRouter } from "@/hooks/use-navigating-router";
import { useTranslations } from "next-intl";
import {
  Alert,
  AuthLayout,
  Button,
  FormField,
  Input,
  PasswordInput,
  PasswordToggle,
  KnowledgeBaseIcon,
  NotificationsIcon,
  TicketsIcon,
  NativeSelect,
  ThemeSwitcher,
} from "@crm/ui";
import { getApiBaseUrl, setAccessToken } from "@/lib/api";
import { resetClientSession } from "@/lib/session";

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
 * Story 171 — now `useNavigatingRouter`, matching `apps/web`'s login page.
 * Story 168 had to leave this as the plain `next/navigation` `useRouter`
 * and document why: this app's overlay listener exposed no
 * `notifyNavigationStart` to call. Story 171 rebuilt that listener on
 * `apps/web`'s mechanism, so the hook now exists here and this screen
 * reports its own `push` like every other navigating call site in the app.
 *
 * Nothing about authentication moved: same `POST /portal/auth/login`, same
 * `credentials: "include"`, same `setAccessToken`, same `/{locale}/home`
 * destination, same two error paths.
 */

/** Story 119's own list, restated here rather than imported: `portal-header.tsx`
 * keeps it module-private and this screen must not depend on an authenticated
 * component. Same source of truth — `apps/portal/src/i18n/routing.ts`. */
const LOCALES = ["en", "ar"] as const;

/** Story 175 — mirrors `apps/web`'s own login panel; the three capabilities
 * are the customer-facing ones. Icons reuse `@crm/ui`'s existing semantic
 * vocabulary, and the copy lives under `auth.marketing.features.*` so EN and
 * AR stay in step. */
const FEATURES = [
  { key: "tickets", Icon: TicketsIcon },
  { key: "knowledge", Icon: KnowledgeBaseIcon },
  { key: "notifications", Icon: NotificationsIcon },
] as const;

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
  const [passwordVisible, setPasswordVisible] = useState(false);

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
      // Final UX pass — see apps/web's login page.
      resetClientSession(router);
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

  // Story 214 (PR-2.2) — the shared AuthLayout (form first in the DOM, the
  // ink brand panel from lg), a password visibility toggle, and — since no
  // reset flow exists (decision PD-7) — a help hint instead of a
  // "Forgot password?" link to nowhere. Sign-in behaviour is unchanged.
  return (
    <AuthLayout
      productName={tCommon("appName")}
      title={t("title")}
      controls={
        <>
          {/* Story 182 (RD-1.5) — appearance and language are chosen here too,
              before signing in. */}
          <NativeSelect
            aria-label={tHome("languageSwitcher.label")}
            size="md"
            value={locale}
            onValueChange={(value) => handleSwitchLocale(value)}
            options={LOCALES.map((localeOption) => ({
              value: localeOption,
              label: tHome(`languageSwitcher.options.${localeOption}`),
            }))}
          />
          <ThemeSwitcher
            label={tHome("themeSwitcher.label")}
            size="md"
            optionLabels={{
              system: tHome("themeSwitcher.options.system"),
              light: tHome("themeSwitcher.options.light"),
              dark: tHome("themeSwitcher.options.dark"),
            }}
          />
        </>
      }
      panel={{
        headline: t("marketing.headline"),
        subheadline: t("marketing.subheadline"),
        features: FEATURES.map(({ key, Icon }) => ({
          key,
          icon: Icon,
          title: t(`marketing.features.${key}.title`),
          description: t(`marketing.features.${key}.description`),
        })),
      }}
    >
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
        <FormField
          density="comfortable"
          label={t("password")}
          action={
            <PasswordToggle
              visible={passwordVisible}
              onVisibleChange={setPasswordVisible}
              showLabel={t("showPassword")}
              hideLabel={t("hidePassword")}
            />
          }
        >
          <PasswordInput
            visible={passwordVisible}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
          />
        </FormField>
        {error && <Alert variant="destructive">{error}</Alert>}
        <Button type="submit" size="lg" isLoading={submitting}>
          {submitting ? t("signingIn") : t("signIn")}
        </Button>
      </form>
      <p className="text-center text-caption text-ink-subtle">{t("forgotPasswordHint")}</p>
    </AuthLayout>
  );
}
