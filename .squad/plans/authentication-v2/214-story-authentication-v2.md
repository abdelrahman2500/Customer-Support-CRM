# Story 214 — Authentication v2 (web + portal)

> CRM product redesign roadmap item **PR-2.2**. Intake: [`../../stories/authentication-v2/authentication-v2/intake.md`](../../stories/authentication-v2/authentication-v2/intake.md). Roadmap: [`../crm-product-redesign/00-overview.md`](../crm-product-redesign/00-overview.md) Phase 2; decision PD-7.

## Prerequisites

Stories 210–212 (chrome tokens, recipes, Card); Stories 168/175 (current logins).

## Story Goal

One sign-in experience for both apps on the ink signature, with a password toggle, an honest forgot-password hint and correct Arabic typography.

**Non-goals:** a reset flow; self-registration; pre-auth branding; backend.

## Design decisions

1. **`AuthLayout`** (`@crm/ui`): `<main>` canvas; form `section` first in the DOM (`lg:order-last`), product name `lg:hidden` + `h1`; the form card (`Card raised` + accent rail); the brand `aside` = `recipes.chrome`, `hidden lg:flex`, with a vertical `from-brand/30` wash and a faint chrome-accent glow (decorative, `aria-hidden`), `h2` headline, `body-lg` subheadline, feature list with chrome-raised icon tiles. Both login pages render it; their handlers are untouched.
2. **Password toggle** — `PasswordInput` (controlled `visible`, `pe-11`) + `PasswordToggle` (icon button, `aria-pressed`, show/hide labels, `type="button"`) placed in a new `FormField` `action` slot: drawn over the md control's end but OUTSIDE the `<label>`, so the input's accessible name stays "Password" (a button inside the label made it "Password Show password" — caught by Playwright).
3. **PD-7** — `auth.forgotPasswordHint` under the form: web "ask your administrator to reset it", portal "contact our support team"; no link.
4. **Arabic face** — `:lang(ar) .font-sans, html:lang(ar)` lead with `var(--font-plex-arabic)`: next/font's `--font-plex-sans` contains a metric fallback (a system face with Arabic glyphs) that otherwise rendered all Arabic text (the RD-1.4 finding), app-wide.
5. **Playwright** — sign-in `getByLabel("Password")` → `{ exact: true }` (10 call sites): Playwright's `getByLabel` also substring-matches the toggle's `aria-label`; the assertions are unchanged.

## Tasks

1. AuthLayout, PasswordInput/PasswordToggle, FormField `action`, icons; specs.
2. Both login pages + messages (en/ar) + spec cases.
3. Token rule + spec; e2e selectors.

## Verification Steps

1. ui/web/portal tests, typecheck, lint; prettier on files clean at HEAD.
2. Web + portal builds; full Playwright suite; harness (both logins, Arabic font check).
3. Protected checksum; hunk-only staging for `index.ts`/`icons.ts` trailing blocks.

## Done Criteria

- [ ] Shared layout, toggle (name "Password"), hint, Arabic face.
- [ ] Suites, builds, Playwright and harness green.
