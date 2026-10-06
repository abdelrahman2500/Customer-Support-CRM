"use client";

import { useState, type FormEvent } from "react";
import { useParams, useSearchParams } from "next/navigation";
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
  ReportsIcon,
  TicketsIcon,
  NativeSelect,
  ThemeSwitcher,
} from "@crm/ui";
import { getApiBaseUrl, setAccessToken } from "@/lib/api";
import { resetClientSession } from "@/lib/session";
import { useNavigatingRouter as useRouter } from "@/hooks/use-navigating-router";

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
 *
 * Story 168 — the first screen of the CRM UI/UX redesign. The hand-rolled
 * surface, the hand-rolled field rows and the disabled/text-swap submit are
 * gone; this now composes `Card` (raised, with a decorative accent rail),
 * `FormField`, `Input`, `Button size="lg" isLoading` and `Alert` over the
 * Story 134 token vocabulary — including the first use anywhere of its
 * named type scale (`text-title`). Identity comes from `common.appName`,
 * which already exists in both locales: no logo asset, no branding
 * endpoint, no new translation key. A pre-auth locale switcher was added,
 * reusing Story 119's `workspace.languageSwitcher` keys and deliberately
 * NOT persisting a preference (nobody is signed in here).
 *
 * Nothing about authentication moved: same `POST /auth/login`, same
 * `credentials: "include"`, same `setAccessToken`, same `/{locale}/tickets`
 * destination, same two error paths, same pending-past-push behaviour.
 */

/** Story 119's own list, restated here rather than imported: `workspace-header.tsx`
 * keeps it module-private and this screen must not depend on an authenticated
 * component. Same source of truth — `apps/web/src/i18n/routing.ts`. */
const LOCALES = ["en", "ar"] as const;

/** Story 175 — the three capabilities the sign-in screen introduces. Icons
 * reuse `@crm/ui`'s existing semantic vocabulary rather than adding art, and
 * the copy lives under `auth.marketing.features.*` so EN and AR stay in
 * step. Decorative beside their own visible title, hence `aria-hidden`. */
const FEATURES = [
  { key: "ticketing", Icon: TicketsIcon },
  { key: "knowledge", Icon: KnowledgeBaseIcon },
  { key: "insights", Icon: ReportsIcon },
] as const;

export default function LoginPage() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const tWorkspace = useTranslations("workspace");
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
   * `workspace-header.tsx`'s `handleSwitchLocale`: that one calls
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
      const response = await fetch(`${getApiBaseUrl()}/auth/login`, {
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
      // Final UX pass — whatever an earlier session left in this tab (its
      // cached signed-in layout above all) is dropped before the new one.
      resetClientSession(router);
      router.push(`/${locale}/tickets`);
      // UX audit — deliberately no `setSubmitting(false)` here. The
      // destination route's own layout does a server-side auth-init round
      // trip (`fetchCurrentUser()` in `(agent)/layout.tsx`) before it can
      // render anything, and `router.push` doesn't wait for that to
      // resolve. Resetting `submitting` immediately used to flip this
      // button back to its idle "Sign in" state while the still-visible
      // login page sat frozen for that entire round trip — the exact
      // "app looks frozen" gap this fix closes. Leaving `submitting` true
      // keeps the button disabled/pending until this component unmounts
      // (real navigation) or an error path below explicitly clears it.
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
            aria-label={tWorkspace("languageSwitcher.label")}
            size="md"
            value={locale}
            onValueChange={(value) => handleSwitchLocale(value)}
            options={LOCALES.map((localeOption) => ({
              value: localeOption,
              label: tWorkspace(`languageSwitcher.options.${localeOption}`),
            }))}
          />
          <ThemeSwitcher
            label={tWorkspace("themeSwitcher.label")}
            size="md"
            optionLabels={{
              system: tWorkspace("themeSwitcher.options.system"),
              light: tWorkspace("themeSwitcher.options.light"),
              dark: tWorkspace("themeSwitcher.options.dark"),
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
