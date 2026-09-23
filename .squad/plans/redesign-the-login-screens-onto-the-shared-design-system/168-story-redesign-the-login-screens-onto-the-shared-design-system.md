# Story 168 — Redesign the Login screens onto the shared design system

---

## Prerequisites

- **Story 167** completed (`38b7ab5`) — the preceding story. No code dependency; this story starts from its HEAD.
- **Story 134** completed — the token vocabulary this story spends. `packages/config/tailwind-tokens.css` defines `--space-*`, `--radius-*` and `--elevation-*`; `packages/config/tailwind-preset.js` exposes them as `p-surface`/`p-shell`/`gap-stack`/…, `rounded-surface`, `shadow-resting`, plus the seven-step `fontSize` scale (`caption`, `label`, `body-sm`, `body`, `subhead`, `heading`, `title`). **Measured at HEAD `38b7ab5`: the `fontSize` scale has zero consumers across `apps/web/src`, `apps/portal/src` and `packages/ui/src`.** This story is its first adoption — exactly what that scale's own comment says it exists for ("These steps give later stories somewhere to go").
- **Story 141 + Story 151** completed — `FormField`, and the fix that moved its hint/error out of the `<label>` so `getByLabelText` matches exactly.
- **Story S-3 / Story 139** completed — `Card` (with `elevation="raised"`), `Button` (with `isLoading` and `size="lg"`), `Alert`, `Input`.
- **Story 95** completed — `AuthRecoveryListener` redirects to `/{locale}/login?reason=session-expired`. That query parameter is a contract this story must not break.
- **Story 119** completed — the post-auth locale switcher in `workspace-header.tsx` / `portal-header.tsx`, and the `workspace.languageSwitcher` / `home.languageSwitcher` keys this story reuses.
- No coordination needed with another owner: nothing in `apps/api`, no schema, no endpoint, no dependency.

---

## Story Goal

Rebuild both Login screens as one deliberate, composed product entry point, spending the design-system vocabulary the repository already owns but has never applied to this screen.

User-visible outcomes:

1. A **composed** login surface — product identity, page heading, a raised panel with an accent top rail, the form, and a clearly dominant primary action — instead of a generic bordered box holding an `h1` and two inputs.
2. Both fields render through `FormField`, so the label/control/error shape is the same one every other form in the product uses.
3. The email field receives focus on load.
4. Submit uses `Button isLoading` — a spinner over a width-stable button — and keeps the existing "stay pending past `router.push`" behaviour.
5. The portal's hand-rolled session-expired paragraph becomes the same `Alert` the web app already uses.
6. A locale switcher is available **before** signing in, on both screens, reusing the existing keys.
7. The screen works from desktop down to a 320px viewport, in English and Arabic, with no horizontal overflow and no physical-direction utility.

**Not in scope:** any backend, endpoint, payload, cookie, token or redirect-destination change; a shared Login component; a new `@crm/ui` primitive; a new token; a password-visibility toggle; forgot-password, remember-me, SSO, MFA; dark mode; the `(agent)`/`(customer)` shells, headers, dashboards or any other route; a general accessibility or responsive audit; the portal's navigation-overlay architecture (see **Design decision 7**).

---

## Context — Read These Files First

1. `apps/web/src/app/[locale]/(auth)/login/page.tsx` — the whole file, **120 lines**. The three Story doc-comment blocks at **~lines 10–33** (Stories 23, 41, 95) and the `// UX audit` comment at **~lines 68–77** explaining why there is deliberately no `setSubmitting(false)` on the success path. **Both must survive this redesign verbatim.** The markup to replace is **~lines 84–119**.
2. `apps/portal/src/app/[locale]/(auth)/login/page.tsx` — the whole file, **117 lines**. Structurally identical; note the two real differences: `useRouter` comes from `next/navigation` (**line 4**, not `@/hooks/use-navigating-router`), and the session-expired state is a hand-rolled `<p className="mt-4 rounded-md border border-rule bg-surface-sunk px-3 py-2 text-sm text-ink-strong">` at **~lines 80–82** rather than an `Alert`.
3. `apps/web/src/app/[locale]/(auth)/login/page.spec.tsx` — **161 lines, 8 tests**. Note the `vi.mock("next/navigation", …)` block at **~lines 9–13** (it mocks `useRouter`, which is what `useNavigatingRouter` calls internally — that is why mocking `next/navigation` is enough), the `useTranslations: () => (key: string) => key` mock at **~lines 15–17** (so every assertion is against the **raw key**), and the field-reaching idiom `screen.getByText("email").querySelector("input")!` used at **~lines 48–51** and six more places.
4. `apps/portal/src/app/[locale]/(auth)/login/page.spec.tsx` — **161 lines, 8 tests**. The same shape, asserting `/portal/auth/login` and `/en/home`.
5. `packages/ui/src/components/form-field.tsx` — **~lines 98–149** for the render, and **~lines 39–63** for the Story 151 doc comment explaining why the hint/error sit outside the `<label>` while the control stays inside it. Note `DENSITY` at **~lines 82–85**: `comfortable` is `text-sm text-ink-strong` — byte-identical to the class string both login pages hand-write on their current `<label>`s.
6. `packages/ui/src/components/button.tsx` — **~lines 51–108**. Read `isLoading` (**~lines 54–68**): it implies `disabled`, sets `aria-busy`, and renders the label in `<span className="invisible …">` with an absolutely-centred `Spinner` over it (**~lines 86–104**). Also **~lines 37–44**: `size="lg"` (`h-10 px-6`) was introduced *for* "a login submit" and is still unadopted in `apps/web`.
7. `packages/ui/src/components/card.tsx` — **~lines 27–56**. `Card` is `rounded-surface border border-rule bg-surface` with **no padding of its own** (padding lives on the sections), and `elevation="raised"` adds `shadow-resting`.
8. `packages/ui/src/components/alert.tsx` — **~lines 6–17** (variants) and **~lines 42–58** (`ROLE_BY_VARIANT`: `default` → `role="status"`, `destructive` → `role="alert"`). This is what makes the portal's paragraph→`Alert` swap an announcement fix, not just a visual one.
9. `packages/config/tailwind-preset.js` — **~lines 139–147** (`fontSize`: the named type scale), **~lines 164–172** (`spacing`: `tight`/`inline`/`stack`/`surface`/`shell`/`field-x`/`field-y`), **~lines 182–186** (`borderRadius`), **~lines 197–200** (`boxShadow`). Everything this story writes must come from these keys or from Tailwind's own layout utilities — no arbitrary values.
10. `apps/web/src/components/workspace/workspace-header.tsx` — **~lines 29–43** (`LOCALES` and `buildLocalePath`) and **~lines 229–241** (the `<select aria-label={t("languageSwitcher.label")}>` markup). This is the switcher shape to mirror. **~lines 165–177** is `handleSwitchLocale` — note it calls `updatePreferredLocale(...)` first; the pre-auth switcher must **not**.
11. `apps/portal/src/components/portal/portal-header.tsx` — **~lines 26–33** and **~lines 231–243**, the portal twin of the above. Its namespace is `home`, not `workspace` (**line 77**).
12. `apps/web/messages/en.json` / `ar.json` — the `auth` block (`title`, `email`, `password`, `signIn`, `signingIn`, `loginFailed`), `common.appName` (`"Customer Support CRM"` / `"نظام إدارة خدمة العملاء"`), `common.errors.unauthorized`, and `workspace.languageSwitcher.{label,options.en,options.ar}`.
13. `apps/portal/messages/en.json` / `ar.json` — the identical `auth` block, `common.appName` (`"Customer Portal"` / `"بوابة العملاء"`), and `home.languageSwitcher.{label,options.en,options.ar}`.
14. `apps/web/src/design-tokens.spec.ts` — **~lines 30–33** (`FORBIDDEN`: no `bg|text|border|ring|divide|fill|stroke|placeholder` + `slate-*|white`) and **~lines 85–96**, whose comment explicitly names "the centred auth/error page shells (`rounded-lg … p-8 shadow-sm`)" as a *legitimate* non-`Card` surface. **This story removes the login half of that exemption by adopting `Card`.** Also `apps/portal/src/design-tokens.spec.ts` **~lines 106–108** (`RAW_ERROR_BOX`).
15. `apps/web/src/components/workspace/workspace-sidebar.spec.tsx` — **~lines 326–341**, the repository's existing "logical-direction classes only" assertion (`/^(ml|mr|pl|pr|left|right|text-left|text-right)-/` must not match). The RTL test in this story's plan copies that idiom.
16. `apps/web/src/hooks/use-navigating-router.ts` — the whole file (52 lines), and `apps/web/src/components/providers/navigation-overlay-listener.tsx` **~lines 20–70**, which records *why* the history-patch mechanism was abandoned. Then `apps/portal/src/components/providers/navigation-overlay-listener.tsx` **~lines 96–121**, which still uses that mechanism and exports no `notifyNavigationStart`. This is the evidence behind **Design decision 7**.
17. Intake: `.squad/stories/redesign-the-login-screens-onto-the-shared-design-system/redesign-the-login-screens-onto-the-shared-design-system/intake.md`.

---

## Product rules (from story)

| | Current behaviour | New behaviour |
|---|---|---|
| Page surface | `div` with `rounded-lg border border-rule bg-surface p-8 shadow-sm` | `Card elevation="raised"` + decorative accent top rail |
| Product identity | None | `common.appName`, above the heading, outside the panel |
| Heading | `<h1 className="text-xl font-semibold text-ink">` | `<h1 className="text-title text-ink">` — same `h1`, first use of the named scale |
| Fields | Hand-rolled `<label className="flex flex-col gap-1 …">` wrapping `Input` | `<FormField density="comfortable">` wrapping the same `Input` |
| Initial focus | Nothing focused | Email input focused on mount |
| Submit | `disabled={submitting}`, text swaps to `signingIn` | `size="lg" isLoading={submitting}`, text still swaps |
| Submit while pending | Stays pending past `router.push` | **Unchanged** |
| Web session-expired | `<Alert>` | **Unchanged** |
| Portal session-expired | Hand-rolled `<p>`, not announced | `<Alert>` → `role="status"`, announced |
| Locale switch | Impossible before signing in | `<select>` on the page, pushes `/{target}/login` preserving the query string |
| Preferred-locale persistence | n/a | **Deliberately none** — `updatePreferredLocale` requires a session |
| Mobile padding at 320px | `p-8` shell + `p-8` panel = 64px of horizontal padding | `px-surface` shell + `p-surface` panel = 32px, widening to `p-shell` at `sm` |
| Auth request / redirect / cookies | `/auth/login` → `/{locale}/tickets`; `/portal/auth/login` → `/{locale}/home` | **Unchanged, all four** |

---

## Frontend Tasks

**No backend changes required.** No file under `apps/api`, no Prisma schema, no DTO, no migration, no `package.json`, no `pnpm-lock.yaml`.

### Design decisions (read before editing)

1. **The composition is a centred column, not a split hero.** A two-panel marketing split would need body copy that does not exist in either catalogue, and the intake forbids inventing keys or decorative assets. Identity is therefore established typographically (`common.appName`), structurally (a raised panel on a sunk page), and with one accent element (the rail). This is what "do not create a marketing landing page" and "use typography, layout, surfaces… to establish identity" resolve to together.
2. **The accent rail is the distinctive element.** A 4px `bg-accent` bar across the top of the panel, `aria-hidden`, inside an `overflow-hidden` `Card`. It costs one decorative node, introduces no colour (`--accent` is the existing primary token, already repointable by the branding story), reads as deliberate product chrome rather than decoration, and simply disappears if `Card`'s radius or surface ever changes. It is the one thing that stops this reading as a default centred form.
3. **`text-title` for the heading.** First consumer of Story 134's `fontSize` scale. The weight (`600`) and letter-spacing come from the scale's own tuple, so the class is `text-title text-ink` with no `font-semibold` beside it. **Do not** add `uppercase` or reach for `text-label` anywhere on this screen: `label`'s `letterSpacing: 0.06em` is wrong for Arabic, which is cursive and joins.
4. **`FormField density="comfortable"`**, which resolves to `text-sm text-ink-strong` — byte-identical to the class string both pages hand-write today, so the label treatment is preserved rather than re-styled. `comfortable`'s own doc comment names login as its intended case.
5. **`Button size="lg" isLoading={submitting}`**, and the label keeps swapping `signIn` → `signingIn`. Both, not either: `isLoading` supplies the spinner and the width-stable pending state; the text swap is what the existing tests assert and what a user reads. See **Edge Cases** for the `aria-label` that goes with it.
6. **The locale switcher is a native `<select>`**, the same element both headers already use, with the same `aria-label` key. Not a `Select` (Radix) — the headers set the repository's precedent for this control, and a portalled Radix popover on an otherwise-static pre-auth page is a larger change than the screen needs. It gains `focus-ring`, which the header selects lack.
7. **The portal keeps `next/navigation`'s `useRouter`.** `useNavigatingRouter` is not portable: it imports `notifyNavigationStart` from `apps/web`'s overlay listener, and **the portal's own listener exports no such function** — it still detects navigation by patching `history.pushState`/`replaceState`, the exact mechanism `apps/web`'s listener documents (**~lines 20–36**) as having been measured non-functional because Next's App Router installs its own wrapper on the same two methods. Porting the web listener's redesign into the portal is a portal-wide infrastructure change, not a Login change, and CLAUDE.md §4 forbids bundling it here. **Record this as a deferred item, do not fix it.** The navigation feedback both screens do share on this screen — the submit button held pending past `push` until unmount — is preserved identically in both files.

### 1 — Web Login

**File: `apps/web/src/app/[locale]/(auth)/login/page.tsx`**

Keep **lines 1–82 semantically intact**: the `"use client"` directive, every existing doc-comment block, all five `useState`/hook calls, and `handleSubmit` in full — including the `// UX audit` comment and the deliberate absence of `setSubmitting(false)` on the success path.

Changes above the return:

- Extend the imports to `import { Alert, Button, Card, FormField, Input } from "@crm/ui";`.
- Add `const tCommon = useTranslations("common");` — already present.
- Add `const tWorkspace = useTranslations("workspace");` for the switcher's two keys.
- Add the module-level locale list beside the component, mirroring `workspace-header.tsx` **~lines 29–30**:

```tsx
/** Story 119's own list, restated here rather than imported: `workspace-header.tsx`
 * keeps it module-private and this screen must not depend on an authenticated
 * component. Same source of truth — `apps/web/src/i18n/routing.ts`. */
const LOCALES = ["en", "ar"] as const;
```

- Add the pre-auth switch handler inside the component:

```tsx
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
```

Replace the return (**~lines 84–119**) with:

```tsx
return (
  <main className="flex min-h-screen flex-col bg-surface-sunk px-surface py-shell sm:px-shell">
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
```

Add one paragraph to the file's existing doc comment recording Story 168, in the same voice as the Story 23/41/95 blocks: what changed visually, that no request, cookie, redirect or error path moved, and that the locale switcher deliberately does not persist a preference.

### 2 — Portal Login

**File: `apps/portal/src/app/[locale]/(auth)/login/page.tsx`**

Apply **task 1 verbatim**, with exactly four differences and no others:

1. `useRouter` keeps coming from `next/navigation` (see **Design decision 7**). Do **not** add a `use-navigating-router` hook to `apps/portal`.
2. The switcher's namespace is `home`, not `workspace`: `const tHome = useTranslations("home");` and `tHome("languageSwitcher.label")` / `tHome(\`languageSwitcher.options.${localeOption}\`)`.
3. The hand-rolled session-expired `<p>` at **~lines 80–82** is **deleted** and replaced by the same `<Alert>{tCommon("errors.unauthorized")}</Alert>` the web page uses. Its `role="status"` now comes from `Alert`'s `ROLE_BY_VARIANT`.
4. `common.appName` resolves to `"Customer Portal"` / `"بوابة العملاء"` — this is the whole of the portal's application-specific identity, and it is why the two screens share a visual language without either becoming the other.

Everything else — `POST /portal/auth/login`, `router.push(\`/${locale}/home\`)`, `setAccessToken`, `credentials: "include"`, the error paths, and the `// UX audit` comment about not clearing `submitting` — is untouched.

### 3 — No other production file changes

No `packages/ui` file. No new component, hook, primitive or export. No `messages/*.json` change in either app (**all six keys this story reads already exist in both locales — verified**). No `tailwind.config.ts`, no token file, no `globals.css`.

---

## Edge Cases & Failure Modes

- **Accessible name during the pending state.** `Button`'s `isLoading` wraps its children in `<span className="invisible">`; per the accessible-name spec, `visibility: hidden` subtrees are excluded, so a real browser would report an unnamed submit button for the entire request. jsdom cannot reproduce this — Tailwind's CSS is never loaded into the test environment, so `invisible` computes to nothing and `getByRole("button", { name: "signingIn" })` **passes either way** (measured directly against the real `Button` at HEAD `38b7ab5`). Enforced by the `aria-label` in task 1, and asserted by attribute rather than by role-name, because a role-name assertion here would be green even if the attribute were dropped. The underlying `Button` behaviour affects all 13 `isLoading` call sites and is **deferred** — fixing the primitive is out of this story's scope.
- **A locale switch mid-typing discards the form.** `router.push` to `/{locale}/login` unmounts the page, so email and password are lost. Accepted, not worked around: the alternative is lifting credentials into the URL or storage, which is worse on every axis. The switch is a deliberate, low-frequency action on an otherwise-empty screen.
- **A locale switch must not lose `?reason=session-expired`.** `searchParams.toString()` is appended, so the banner survives. Without it, a user who switched language after a session expiry would silently lose the explanation for why they are here. Covered by test 9.
- **`updatePreferredLocale` must not be called.** Nobody is authenticated on this screen; the call would 401 and either throw or be swallowed, and there is no user row to write to. The pre-auth handler deliberately omits it, and this is the only behavioural difference from `workspace-header.tsx`'s handler. Covered by test 11 (the mocked `@/lib/api` module records zero calls).
- **`autoFocus` and the session-expired banner compete for attention.** They do not conflict: the `Alert` is `role="status"` (polite, announced at the next pause) while focus lands on the email input. Focusing the banner instead would be wrong — it is context, not a destination.
- **Empty or malformed submission.** Unchanged. `required` stays on both `Input`s and native validation still blocks submit before `handleSubmit` runs; `FormField` adds no validation of its own and its `error` prop is deliberately **not** used here (this screen's only error is form-level, and it stays in the `Alert`).
- **`FormField` and `aria-invalid`.** Because no `error` prop is passed, `FormField` injects `aria-invalid: undefined` — it does not mark the fields invalid on a failed login. That is correct: a rejected credential pair is not a field-level validation failure, and marking both fields invalid would be a false claim about which one is wrong.
- **320px viewport.** `max-w-sm` is 24rem/384px, so at 320px the column is bounded by `px-surface` (16px each side) → 288px panel → `p-surface` (16px) → 256px of content. The current design spends 64px on horizontal padding at that width; this spends 32px. `sm:px-shell` / `sm:p-shell` restores the generous desktop rhythm at ≥640px.
- **Horizontal overflow.** Nothing on the screen has an intrinsic minimum width: the `<select>` is `h-9 px-2` with two short options, `Input` is `w-full`, and the longest string (`auth.loginFailed`, 63 characters in EN / 71 in AR) wraps inside the `Alert`. No `whitespace-nowrap` is introduced anywhere.
- **Arabic layout.** Every class used is logical or symmetric — `justify-end`, `text-center`, `px-*`, `py-*`, `gap-*`, `mb-stack`. The accent rail is `w-full`, so it is direction-agnostic by construction. `dir` continues to come from `[locale]/layout.tsx` **~line 39** (web) / **~line 33** (portal); neither layout is touched.
- **Arabic and the type scale.** `text-title` carries `letterSpacing: -0.015em`. A small negative tracking is safe on Arabic (it does not break joining); `text-label`'s `+0.06em` is the one to avoid, and this story uses it nowhere.
- **A pre-existing `?reason=` value other than `session-expired`.** Unchanged: the strict `=== "session-expired"` comparison stays, so any other value renders no banner.
- **The portal's navigation overlay.** Documented in **Design decision 7** and deferred. The user-visible consequence on this screen is none — the pending `Button` is the feedback, and it behaves identically in both apps.
- **Both `design-tokens.spec.ts` guards.** The new markup uses only token classes, so `FORBIDDEN` (`slate-*`/`white`) cannot match; `HAND_ROLLED_SURFACE` (`rounded-md border border-rule bg-surface p-4`) never matched these files and still will not; the portal's `RAW_ERROR_BOX` matched nothing here before and the `<p>` being deleted was not a red box. No guard needs editing — **if one needs editing, the implementation has drifted from this plan.**

---

## Test Plan

**Measured baselines at HEAD `38b7ab5`:** `@crm/web` 85 files / **1243** tests; `@crm/portal` 44 files / **379** tests; `@crm/ui` 30 files / **268** tests.

**Measured, and load-bearing for this plan:** against the real `FormField` + `Input` in this repository's own jsdom environment, `screen.getByText("email")` returns the `<LABEL>` element and `.querySelector("input")` still finds the control — because `FormField` renders `{label}` as a direct text child of the `<label>` and keeps the control inside it. **Every one of the 16 existing login tests therefore passes unmodified after the migration.** The updates below are improvements, not repairs; `getByLabelText` now matches exactly thanks to Story 151, and that is the query to prefer.

Apply the same list to **both** `apps/web/src/app/[locale]/(auth)/login/page.spec.tsx` and `apps/portal/src/app/[locale]/(auth)/login/page.spec.tsx`, adjusting only the endpoint (`/auth/login` vs `/portal/auth/login`), the destination (`/en/tickets` vs `/en/home`) and the sample email.

1. **Existing 8 tests per app — keep all 8, do not weaken or delete any.** Replace each `screen.getByText("email").querySelector("input")!` with `screen.getByLabelText("email")`, and the password equivalent. Every other assertion in them stays byte-identical, including `getByText("signingIn").closest("button")` being disabled past the push.
2. **Initial focus.** Render, then `expect(screen.getByLabelText("email")).toHaveFocus()`. Measured: `autoFocus` on the real `Input` does focus it under jsdom.
3. **Fields render through `FormField`.** Assert the label/control association directly — `getByLabelText("email")` and `getByLabelText("password")` each return an `<input>` whose `type` is `email` / `password`, and `getByLabelText("email")` has `autocomplete="email"`. This is the behavioural form of "both fields use `FormField`" and does not assert on class names.
4. **Submit uses the loading treatment.** With `fetch` pending, assert the submit button has `aria-busy="true"` and is disabled. Together with test 1's retained assertions this pins `isLoading` rather than the old `disabled`-only state.
5. **The pending button keeps a name.** `expect(submitButton).toHaveAttribute("aria-label", "signingIn")` while submitting, and `expect(submitButton).not.toHaveAttribute("aria-label")` when idle. Asserted by attribute deliberately — see **Edge Cases**; a role-name query cannot distinguish the two in jsdom.
6. **Heading structure.** `getByRole("heading", { level: 1 })` has the accessible name `"title"`, and the page contains exactly one `h1`. Guards "semantic heading structure is preserved".
7. **Product identity is present.** `getByText("appName")` is in the document. (Under the spec's key-echo translation mock this is the literal string `appName`; the real catalogues resolve it to the two different product names — asserted in test 13.)
8. **The locale switcher exists and is named.** `getByRole("combobox", { name: "languageSwitcher.label" })` exists, has value `"en"`, and offers exactly two options.
9. **Switching locale navigates, preserving the query string.** Set `searchParams = new URLSearchParams("reason=session-expired")`, select `"ar"`, assert `push` was called with `"/ar/login?reason=session-expired"`. Then a second case with no query string asserting plain `"/ar/login"`.
10. **Selecting the current locale is a no-op.** Select `"en"` while on `en`; `expect(push).not.toHaveBeenCalled()`.
11. **The pre-auth switcher persists nothing.** Assert no request is made when switching — `expect(fetch).not.toHaveBeenCalled()` after the locale change. This is the test that would catch someone copying `workspace-header.tsx`'s `updatePreferredLocale` call into this screen.
12. **RTL safety — no physical-direction utility.** Copy the idiom from `apps/web/src/components/workspace/workspace-sidebar.spec.tsx` **~lines 334–338**: walk every element in `container.querySelectorAll("[class]")` and assert no class matches `/^(ml|mr|pl|pr|left|right|text-left|text-right)-/` and none is `border-l-*`/`border-r-*`. This is the one class-level assertion in the plan, and it guards a criterion no behavioural test can reach.
13. **EN/AR catalogue coverage — a new shared spec per app.** `apps/web/src/test/login-messages.spec.ts` and `apps/portal/src/test/login-messages.spec.ts`, modelled on the existing `apps/web/src/test/fetch-state-messages.spec.ts` (**~lines 1–40**). For each of `en` and `ar`, assert every key this screen now reads is a non-empty string: `auth.title`, `auth.email`, `auth.password`, `auth.signIn`, `auth.signingIn`, `auth.loginFailed`, `common.appName`, `common.errors.unauthorized`, and `workspace.languageSwitcher.label` + `.options.en` + `.options.ar` (web) / `home.languageSwitcher.*` (portal). Also assert `en.common.appName !== ar.common.appName`, so a missing Arabic product name cannot pass silently. This is how "EN/AR behaviour is verified" is met without rendering under a real `NextIntlClientProvider` in a spec whose translation mock is key-echo.

**Portal-only, in addition:**

14. **The session-expired state is an `Alert`, and is announced.** `getByRole("status")` has the accessible name / text content `"errors.unauthorized"` when `?reason=session-expired` is set. Against today's `<p>` this test fails — it is the one that pins the portal's paragraph→`Alert` fix. The three existing portal session-expired tests (**~lines 42–75**) keep passing unchanged alongside it.

**Deliberately not tested:** visual composition (the rail, the raised card, the type scale, the responsive padding) beyond test 12's direction guard. Those are class-level facts that a unit test can only restate, not verify; they are covered by the manual verification steps below.

---

## Verification Steps

1. **Frontend runs:** `pnpm --filter @crm/web test` from the repository root. Expect **1243 + the new cases**, 0 failures, 85 test files (or 86 once `login-messages.spec.ts` is added).
2. **Frontend runs:** `pnpm --filter @crm/portal test`. Expect **379 + the new cases**, 0 failures.
3. **Regression:** `pnpm --filter @crm/ui test` — expected **unchanged at 268**. Any change means the edit leaked into `packages/ui`, which this story does not touch.
4. **Regression:** both `design-tokens.spec.ts` files pass as part of steps 1–2. No guard regex may be edited to accommodate this story.
5. **Backend builds:** `pnpm typecheck`, then `pnpm lint`, then `pnpm build`, each from the repository root.
6. **Manual — desktop, EN:** `pnpm --filter @crm/web dev`, open `http://localhost:3000/en/login`. Confirm: accent rail across the panel top, raised panel on the sunk page, product name above the heading, email focused on load, visible focus ring when tabbing through email → password → submit → language, and the submit button showing a spinner at a fixed width on click.
7. **Manual — RTL:** `http://localhost:3000/ar/login`. Confirm the heading, identity line, fields and rail all mirror correctly, the language select sits on the logical end edge, and no element overflows.
8. **Manual — narrow:** the same two URLs at a 320px viewport (DevTools). Confirm no horizontal scrollbar, that the panel keeps a comfortable internal rhythm, and that the identity/heading/form hierarchy still reads.
9. **Manual — portal:** `pnpm --filter @crm/portal dev`, then `http://localhost:3002/en/login` and `/ar/login`. Confirm the same composition with `"Customer Portal"` as the identity line, and that `/en/login?reason=session-expired` renders the banner as a bordered `Alert`.
10. **Manual — locale switch before auth:** on `/en/login?reason=session-expired`, switch to Arabic. Confirm the URL becomes `/ar/login?reason=session-expired`, the banner is still shown, and the Network tab records **no** request (in particular, no `PATCH`/`PUT` to a locale endpoint).
11. **Regression — no i18n drift:** `git diff --stat -- apps/web/messages apps/portal/messages` is **empty**.
12. **Regression — no dependency change:** `git diff --stat -- '**/package.json' pnpm-lock.yaml` is **empty**.
13. **Regression — scope:** `git status --short` shows exactly the four login files, the two new `*-messages.spec.ts` files, and this plan folder. No file under `apps/api`, `packages/ui`, `packages/config`, or any other route.
14. **Re-scan:** `grep -rnE '\b(ml|mr|pl|pr|text-left|text-right)-' "apps/web/src/app/[locale]/(auth)/login/page.tsx" "apps/portal/src/app/[locale]/(auth)/login/page.tsx"` returns **no** match.

---

## Done Criteria

- [ ] Both Login screens render a composed layout — identity line, `h1`, raised `Card` with an `aria-hidden` accent rail, form, dominant primary action — not a single bordered box.
- [ ] `Card`, `FormField`, `Input`, `Button` and `Alert` are all reused; no new shared component, hook or `@crm/ui` primitive is added.
- [ ] Every surface, border, radius, elevation, spacing and type value comes from an existing token (`bg-surface*`, `border-rule*`, `rounded-surface`, `shadow-resting` via `elevation="raised"`, `p-surface`/`p-shell`/`gap-stack`/`gap-tight`/`mb-stack`, `text-title`). No arbitrary value and no raw `slate-*`/`white` class anywhere.
- [ ] The `h1` uses `text-title` — the first adoption of Story 134's named type scale.
- [ ] Both fields use `FormField density="comfortable"`; labels stay programmatically associated and `getByLabelText` resolves each control exactly.
- [ ] The email field is focused on load.
- [ ] Submit uses `size="lg" isLoading={submitting}`, carries `aria-label` only while pending, and still stays pending past `router.push` until unmount.
- [ ] Native `required` validation and the existing submit handler are unchanged.
- [ ] Web still `POST`s `/auth/login` and redirects to `/{locale}/tickets`; portal still `POST`s `/portal/auth/login` and redirects to `/{locale}/home`; `setAccessToken`, `credentials: "include"` and both error paths are untouched.
- [ ] The portal's session-expired message renders through `Alert` (`role="status"`), matching web.
- [ ] A locale switcher is present on both screens, named from the existing `languageSwitcher.label` key, pushing `/{target}/login` with the query string preserved, and making **no** network request.
- [ ] No translation key is added, removed or reworded in either app; `git diff` over both `messages/` directories is empty.
- [ ] No physical-direction utility on either page (test 12 and verification step 14 both green).
- [ ] No horizontal overflow, and the form is comfortably usable at 320px (verification step 8).
- [ ] All 16 existing login tests still pass, none weakened, skipped or deleted; the new tests cover focus, the loading state, the pending name, the locale switch (including the no-op and no-request cases), the heading structure and the portal `Alert`.
- [ ] Both new `login-messages.spec.ts` files pass, covering every key this screen reads in both EN and AR.
- [ ] `@crm/ui` suite unchanged at 268; web, portal, typecheck, lint and build all green.
- [ ] The two deferred items are recorded in the completion report and fixed nowhere: `Button`'s accessible name under `isLoading`, and the portal navigation-overlay listener's abandoned history-patch mechanism.
