"use client";

import { useState, type FormEvent } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Alert,
  Button,
  Card,
  FormField,
  Input,
  KnowledgeBaseIcon,
  ReportsIcon,
  TicketsIcon,
} from "@crm/ui";
import { getApiBaseUrl, setAccessToken } from "@/lib/api";
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

  return (
    <main className="min-h-screen bg-surface-sunk">
      <div className="mx-auto flex min-h-screen w-full max-w-screen-2xl flex-col lg:flex-row">
        {/*
         * The sign-in column comes FIRST in the DOM and is moved to the
         * logical end at `lg` with `order-last`. That keeps the document
         * outline correct — this column owns the page's single `h1`, and the
         * brand panel's `h2` follows it — and keeps the keyboard on the form
         * rather than tabbing through a panel that holds no controls.
         * `order-*` is flex order, not a physical direction, so the split
         * mirrors correctly under `dir="rtl"` with nothing to configure.
         */}
        <section className="flex flex-1 flex-col px-surface py-shell sm:px-shell lg:order-last">
          {/* The locale switcher sits on the page, not inside the panel: it is a
              property of how you read this screen, not a field you fill in.
              `justify-end` is logical, so it lands on the correct edge in both
              directions without a single `ml-*`/`mr-*`. */}
          <div className="flex justify-end">
            <select
              aria-label={tWorkspace("languageSwitcher.label")}
              className="focus-ring h-9 rounded-surface border border-rule-strong bg-surface px-2 text-sm text-ink"
              value={locale}
              onChange={(event) => handleSwitchLocale(event.target.value)}
            >
              {LOCALES.map((localeOption) => (
                <option key={localeOption} value={localeOption}>
                  {tWorkspace(`languageSwitcher.options.${localeOption}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-sm">
              {/* Identity block, outside the panel. Two steps of one hierarchy:
                  which product this is, then what you are doing in it. */}
              <div className="mb-stack flex flex-col gap-tight text-center">
                {/* Story 175 — `lg:hidden`: from `lg` up the brand panel owns
                    the product name, so printing it here too would say the
                    same thing twice on one screen. Below `lg` the panel is
                    not rendered and this is the only identity on the page. */}
                <span className="text-sm font-medium text-ink-muted lg:hidden">
                  {tCommon("appName")}
                </span>
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
                    <Button type="submit" size="lg" isLoading={submitting}>
                      {submitting ? t("signingIn") : t("signIn")}
                    </Button>
                  </form>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/*
         * Story 175 — the brand panel. Real content, not decoration, so it is
         * NOT `aria-hidden`; below `lg` it is simply not rendered, because a
         * shrunken marketing panel stacked above a login form is noise on a
         * phone rather than a fallback.
         *
         * The gradient runs `to-b` rather than diagonally on purpose: a
         * vertical gradient is identical under both reading directions, so
         * there is no RTL asymmetry to correct. Both stops are existing
         * tokens, so a branch's configured accent repoints this panel with no
         * edit here.
         */}
        <aside className="relative hidden overflow-hidden bg-gradient-to-b from-accent to-accent-hover text-accent-foreground lg:flex lg:flex-1 lg:flex-col lg:justify-center lg:p-shell">
          {/* Abstract depth only — `aria-hidden`, positioned with logical
              insets so the composition mirrors under RTL. */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -start-24 h-80 w-80 rounded-pill bg-accent-foreground/20 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-32 -end-16 h-96 w-96 rounded-pill bg-accent-surface/20 blur-3xl"
          />

          <div className="relative flex max-w-lg flex-col gap-stack">
            <span className="text-sm font-medium text-accent-foreground/80">
              {tCommon("appName")}
            </span>
            <h2 className="text-title">{t("marketing.headline")}</h2>
            <p className="text-sm text-accent-foreground/80">{t("marketing.subheadline")}</p>

            <ul className="mt-stack flex flex-col gap-stack">
              {FEATURES.map(({ key, Icon }) => (
                <li key={key} className="flex items-start gap-inline">
                  <span
                    aria-hidden
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-surface bg-accent-foreground/10"
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="flex flex-col gap-tight">
                    <span className="text-sm font-semibold">
                      {t(`marketing.features.${key}.title`)}
                    </span>
                    <span className="text-sm text-accent-foreground/80">
                      {t(`marketing.features.${key}.description`)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}
