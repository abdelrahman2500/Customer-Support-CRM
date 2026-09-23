# Story 175 — Modern login page redesign

---

## Prerequisites

- **Story 174** completed (`a21ab9d`) — HEAD only, no code dependency.
- **Story 168** completed (`d7fbbcb`) — the current login composition this replaces; its auth behaviour, locale switcher and session-expired handling are carried over unchanged.
- **Story 171** completed — the portal's own `useNavigatingRouter`, which the portal login uses and keeps.
- **Story 170 / 134** — `text-title` and the spacing tokens spent here.
- Precedent for tone: [`../make-the-agent-workspace-header-safe-below-sm/173-story-make-the-agent-workspace-header-safe-below-sm.md`](../make-the-agent-workspace-header-safe-below-sm/173-story-make-the-agent-workspace-header-safe-below-sm.md).

---

## Story Goal

Turn both login screens into a full-screen split composition — a branded product section beside the sign-in card — without touching a single line of authentication behaviour.

1. Desktop: branded visual section on the logical start side, sign-in column on the logical end side.
2. Below `lg`: the visual section is not rendered; the sign-in column fills the screen.
3. The visual section introduces the product: name, headline, supporting line, three capabilities with icons.
4. Every existing behaviour — request, redirect, cookies, errors, session-expired, locale switch, focus, loading — is byte-for-byte the same.

**Not in scope:** dark mode; any auth/API/cookie/redirect change; branding `onError`; the authenticated shells; new primitives, tokens or dependencies.

---

## Context — Read These Files First

1. `apps/web/src/app/[locale]/(auth)/login/page.tsx` — **lines 1–123 are carried over verbatim** (imports, `LOCALES`, all state, `handleSwitchLocale`, `handleSubmit`, every doc comment). Only the `return (…)` at **lines 124–192** is replaced.
2. `apps/portal/src/app/[locale]/(auth)/login/page.tsx` — same split; its `return` is **lines ~124–191**. Note it imports `useNavigatingRouter as useRouter` (Story 171) — **keep it**.
3. `apps/web/src/app/[locale]/(auth)/login/page.spec.tsx` and the portal twin — the assertions that must keep passing: single `h1` named `title`, `getByText("appName")`, `getByRole("combobox", { name: "languageSwitcher.label" })`, `aria-busy` on submit, the locale-switch push targets, and the logical-direction class guard.
4. `packages/ui/src/lib/icons.ts` — **lines 79–88**: `TicketsIcon`, `KnowledgeBaseIcon`, `NotificationsIcon`, `ReportsIcon` all exist and are exported from `@crm/ui`.
5. `packages/config/tailwind-preset.js` — **lines 59–115** (`accent`, `accent-hover`, `accent-foreground` are tokens usable in gradients) and **lines 164–172** (spacing).
6. `apps/web/messages/en.json` / `ar.json`, `apps/portal/messages/{en,ar}.json` — the `auth` block gains a `marketing` sub-object.

---

## Product rules (from story)

| | Current | New |
|---|---|---|
| Layout | one centred column, `max-w-sm` | split at `lg`; single column below |
| Background | flat `bg-surface-sunk` | sunk on the form side; token gradient on the visual side |
| Product messaging | `common.appName` only | name + headline + supporting line + 3 capabilities |
| Below `lg` | centred form | **visual section not rendered**, form fills screen |
| `h1` | `auth.title` | **unchanged** — `auth.title`, still exactly one |
| Auth request / redirect / cookies / errors | — | **unchanged** |
| Session-expired `Alert` | — | **unchanged** |
| Locale switcher | top, logical end | **unchanged**, inside the form column |

---

## Frontend Tasks

**No backend changes required.**

### Design decisions

1. **DOM order is form-first, visual-second; desktop order is flipped with `lg:order-first`.** This keeps the document outline correct (`h1` "Sign in" before the visual section's `h2`) and keeps the tab order on the form, while showing the brand panel on the start side at desktop. `order-*` is flex order, not a physical-direction utility, so RTL mirrors correctly.
2. **The visual section is `hidden lg:flex`.** The intake asks for the mobile fallback to reduce or hide it; hiding is the honest choice — a shrunken marketing panel above a login form is noise on a phone. It is real content, not decoration, so it is **not** `aria-hidden`; below `lg` it is simply absent from the tree.
3. **Gradient direction `to-b`, not a diagonal**, so the treatment is identical in both reading directions. Colours are `from-accent` / `to-accent-hover` — existing tokens.
4. **Decorative blobs use logical insets** (`start-*`/`end-*`) and `aria-hidden`, tinted with `bg-accent-foreground/10`. Opacity modifiers are legitimate: the token layer stores RGB channels precisely so `/nn` works.
5. **Exactly one `h1` stays `auth.title`.** The visual headline is an `h2`. This preserves every existing heading assertion.

### 1 — Web login markup

**File: `apps/web/src/app/[locale]/(auth)/login/page.tsx`**

Extend the import from `@crm/ui` to add `KnowledgeBaseIcon`, `ReportsIcon`, `TicketsIcon`. Add a module-level capability list beside `LOCALES`:

```tsx
/** Story 175 — the three capabilities the sign-in screen introduces. Icons
 * come from `@crm/ui`'s existing semantic vocabulary; copy lives in the
 * `auth.marketing.features.*` catalogue so both locales stay in step. */
const FEATURES = [
  { key: "ticketing", Icon: TicketsIcon },
  { key: "knowledge", Icon: KnowledgeBaseIcon },
  { key: "insights", Icon: ReportsIcon },
] as const;
```

Replace the `return (…)` with the split composition: a `<main>` holding a `lg:flex-row` wrapper; a `<section>` carrying the locale switcher, identity block, `h1` and the existing `Card` unchanged; and an `<aside className="hidden … lg:order-first lg:flex">` carrying the gradient, the decorative blobs, `common.appName`, an `h2` headline, a supporting `<p>` and the three-capability `<ul>`.

**Carry over unchanged:** the locale `<select>` and its `aria-label`, the identity `<span>`, the `h1`, the `Card`/accent rail, both `FormField`s with `autoFocus` on email, the `Alert`s, and the submit `Button`.

### 2 — Portal login markup

**File: `apps/portal/src/app/[locale]/(auth)/login/page.tsx`**

Identical composition. Four differences only: `useTranslations("home")` for the switcher keys, `NotificationsIcon` in place of `ReportsIcon`, the portal's own `auth.marketing.*` copy, and `common.appName` resolving to "Customer Portal". `useNavigatingRouter`, `POST /portal/auth/login` and `/{locale}/home` are untouched.

### 3 — Translation keys

**Files:** `apps/web/messages/{en,ar}.json`, `apps/portal/messages/{en,ar}.json`

Add under `auth`:

```json
"marketing": {
  "headline": "…",
  "subheadline": "…",
  "features": {
    "<key>": { "title": "…", "description": "…" }
  }
}
```

Web keys: `ticketing`, `knowledge`, `insights`. Portal keys: `tickets`, `knowledge`, `notifications`. Arabic must be real translation.

### 4 — Tests

Extend both login specs with a `describe("split composition (Story 175)")` covering the headline, the supporting line, three capabilities, and that the visual section is absent from the mobile DOM only by its `hidden lg:flex` class (jsdom applies no media queries). Keep every existing test.

---

## Edge Cases & Failure Modes

- **Two headings competing for `h1`.** Trigger: making the marketing headline an `h1`. Expected: exactly one `h1` (`auth.title`); the marketing headline is an `h2`. Existing specs assert `getAllByRole("heading", { level: 1 })` has length 1 — they will catch a regression.
- **jsdom renders `hidden lg:flex` content anyway.** No CSS is loaded, so the visual section *is* in the test DOM and its text is queryable. Tests must assert on classes for visibility, never assume absence.
- **Long Arabic copy overflowing the panel.** The panel is `max-w-md` inside a padded flex column, so text wraps. Verify at 1440 and 1280 in AR.
- **320px overflow.** The visual section is not rendered below `lg`, so the form column is the whole page — the same composition Story 168 already verified at 320px. Re-verify anyway; Stories 173/174 exist because narrow widths are where this repo's regressions live.
- **RTL mirroring of the split.** `lg:order-first` plus flex mirrors automatically. The gradient is vertical, so it is direction-neutral by construction. Decorative blobs use `start-*`/`end-*`.
- **Icon accessibility.** Capability icons are decorative next to their own visible title, so each carries `aria-hidden` — the convention `packages/ui/src/lib/icons.ts` already documents.
- **Missing key in one locale** would render the raw key path on the product's front door. Guarded by extending the existing `login-messages.spec.ts` in both apps.

---

## Test Plan

1. **Both login specs** — add `describe("split composition (Story 175)")`: headline and supporting line present; exactly three capability items; the visual section carries `hidden` and `lg:flex`; still exactly one `h1` named `title`.
2. **Both `src/test/login-messages.spec.ts`** — extend to assert every new `auth.marketing.*` key is a non-empty string in EN and AR, and that EN ≠ AR for the headline (catches an untranslated copy-paste).
3. **All existing login tests unchanged.**
4. **The existing logical-direction guard** in each login spec must still pass over the new markup.

---

## Verification Steps

1. **Frontend runs:** `pnpm --filter @crm/web test` and `pnpm --filter @crm/portal test`.
2. **Regression:** `pnpm --filter @crm/ui test` — expected unchanged at 312.
3. **Backend builds:** `pnpm typecheck`, `pnpm lint`, `pnpm build`.
4. **Browser** (force-rebuild first): `/en/login` and `/ar/login` on **both apps** at **1440**, **834** and **320**, asserting `scrollWidth === clientWidth` at each, plus screenshots for visual review.
5. **Regression:** the authenticated 23-route × EN/AR 320px sweep still reports 23/23 — this story must not disturb Story 174's result.
6. **Scope:** `git status --short` shows only the two page files, their two specs, the two message-spec files and the four catalogues.

---

## Done Criteria

- [ ] Split layout at `lg`+, single column below, on both apps.
- [ ] Visual section: product name, `h2` headline, supporting line, exactly three capabilities with icons.
- [ ] Gradient from `accent`/`accent-hover` tokens; no raw colour anywhere.
- [ ] Auth request, redirect, cookies, error paths and session-expired behaviour unchanged.
- [ ] Locale switcher, initial focus and loading state unchanged.
- [ ] Exactly one `h1` per page, still `auth.title`.
- [ ] All new copy present in EN and AR in both apps.
- [ ] No physical-direction utility; RTL verified in a browser.
- [ ] No overflow at 320 / 834 / 1440 in either locale, either app.
- [ ] Authenticated 320px sweep still 23/23.
- [ ] No new dependency, primitive or token; no dark mode.
- [ ] Existing tests pass, updated only where the new DOM required it.
