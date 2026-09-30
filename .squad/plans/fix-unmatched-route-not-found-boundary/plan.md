# Story 177 — Fix the unmatched-route 404 boundary in both apps

> **Revision 2.** Phase 0 is complete. Directions A and B are empirically disqualified; **Direction D is selected** and its design questions are resolved below. Revision 1's open decision gate is retained as **§4 — Phase 0 result** for traceability.

---

## Prerequisites

- **Story 176** completed (`29f6a40`) — put the six error/not-found `h1`s on `text-title`. That work is correct and stays; this story is what makes it **visible** on the one 404 users actually reach. Do not revisit the type scale.
- **Story 96** — created all four boundaries. Two of its doc comments describe behaviour Phase 0 disproved; correcting them is in scope.
- **Story 119 / RM-12** — next-intl locale routing and the middleware. **Read-only**, but every acceptance criterion depends on them behaving exactly as they do today.
- Precedent for tone: [`../make-the-agent-workspace-header-safe-below-sm/173-story-make-the-agent-workspace-header-safe-below-sm.md`](../make-the-agent-workspace-header-safe-below-sm/173-story-make-the-agent-workspace-header-safe-below-sm.md).

---

## Story Goal

Make an unmatched URL render a **styled, correctly-localised 404 with a real 404 status** in both apps.

1. `/en/nope` and `/ar/nope` → HTTP 404, exactly one `<html>` and one `<body>`, at least one stylesheet `<link>`, `h1` computing to 24px/600.
2. `/ar/nope` → `lang="ar" dir="rtl"` with Arabic copy; `/en/nope` → `lang="en" dir="ltr"` with English copy.
3. No not-found boundary is left with tests implying coverage it does not have.

**Not in scope:** `[locale]/error.tsx`; `global-error.tsx`; the Sentry global-error warning; the middleware matcher or any locale-negotiation rule; the `/` → `/en`, `/nope` → `/en/nope`, `/xx/tickets` → `/en/xx/tickets` redirects; any new dependency; any visual redesign or copy change beyond what a localised 404 requires.

---

## Established facts

Measured at `29f6a40`. Rows 1–11 are the recon; rows 12–18 are Phase 0. **Do not re-derive these.**

| #   | Fact                                                                                                                                                                                                                    | Evidence                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 1   | Neither app has `app/layout.tsx`; the document lives at `app/[locale]/layout.tsx`                                                                                                                                       | directory listing               |
| 2   | `_not-found.html` contains **two** `<html>`: Next's attribute-less outer one, then `<html lang="en" dir="ltr">` from `app/not-found.tsx`                                                                                | prerendered artifact            |
| 3   | `app-build-manifest.json` maps `/_not-found/page` → the 31KB Tailwind bundle                                                                                                                                            | manifest                        |
| 4   | That artifact contains **zero** `stylesheet`/`.css` references                                                                                                                                                          | grep                            |
| 5   | `/en/login` emits 1 `<html>` and **2** stylesheet links (browser-counted)                                                                                                                                               | live                            |
| 6   | `/en/nope`, `/ar/nope` → 404, 2 `<html>`, 0 CSS, both `lang="en" dir="ltr"`                                                                                                                                             | live, both apps                 |
| 7   | `/xx/tickets` → 307 `/en/xx/tickets`; `/nope` → 307 `/en/nope`; `/` → 307 `/en`                                                                                                                                         | live                            |
| 8   | Unmatched routes resolve to `/_not-found`, outside `[locale]`                                                                                                                                                           | `app-path-routes-manifest.json` |
| 9   | `[locale]/layout.tsx`'s `notFound()` is unreachable — middleware prefixes the default locale first                                                                                                                      | fact 7                          |
| 10  | Web and portal are identical on every row — one root cause                                                                                                                                                              | live, both apps                 |
| 11  | Next **15.5.23**; next-intl **4.13.7**                                                                                                                                                                                  | package.json                    |
| 12  | **A1** — removing the self-rendered document: `<html>` 2→**1**, CSS still **0**, `lang`/`dir` become **empty**                                                                                                          | build + live                    |
| 13  | **A2** — manifest still associates the CSS; no `<style>` block, no JS-injected CSS; browser computes **32px/700**                                                                                                       | build + browser                 |
| 14  | **B** — catch-all → `notFound()`: 1 `<html>`, 2 CSS, `ar`/`rtl`, Arabic copy, 24px/600 — but **HTTP 200**                                                                                                               | build + browser                 |
| 15  | **B2** — `force-dynamic` does not change the 200                                                                                                                                                                        | build + live                    |
| 16  | **Isolation** — `notFound()` from the ordinary `[locale]/page.tsx` also returns **200** ⇒ the 200 is structural (the async `[locale]/layout.tsx` starts streaming before the descendant throws), not catch-all-specific | build + live                    |
| 17  | **C-min** — a root `app/layout.tsx` owning the `globals.css` import, rendering **no** document tags: `/en/nope` → **404, 1 `<html>`, CSS emitted**; `/en/login` unchanged at 1 `<html>` / 2 CSS                         | build + browser                 |
| 18  | **D** — C-min + locale from the `NEXT_LOCALE` cookie: `/ar/nope` → **404, 1 `<html>`, CSS, `lang="ar" dir="rtl"`, Arabic copy, 24px/600**, verified **cold** with no pre-existing cookie                                | build + browser                 |

**Root cause, now proven (fact 17):** Next emits the stylesheet `<link>` for CSS imported by a **layout** in the segment chain — not for CSS imported by the not-found boundary itself when no root layout exists. That is why the manifest and the response disagreed.

**Second, independent cause (fact 16):** a 404 **status** can only come from Next's own `/_not-found` route. Any `notFound()` raised inside `[locale]` renders the right UI with a 200, because the response has already begun streaming.

---

## Phase 0 result

| direction                     | status  | `<html>` | CSS    | `/ar/nope` lang/dir | verdict                                       |
| ----------------------------- | ------- | -------- | ------ | ------------------- | --------------------------------------------- |
| A (A1 + A2)                   | 404     | 1        | **0**  | none                | **rejected** — CSS never emitted; locale lost |
| B / B2                        | **200** | 1        | 2      | correct             | **rejected** — cannot produce 404 (fact 16)   |
| C (full restructure)          | not run | —        | —      | —                   | unnecessary — C-min suffices                  |
| **D = C-min + cookie locale** | **404** | **1**    | **≥1** | **correct**         | **SELECTED**                                  |

D is the only direction that satisfies criteria 1–6 simultaneously, and it does so without touching middleware, locale negotiation, redirects or any route's rendering.

---

## Design resolutions

### D.1 — Root layout and document ownership

**Create `src/app/layout.tsx` in both apps.** It owns **exactly one thing: the global stylesheet import.** It renders `{children}` and **no document tags**.

```
export default function RootLayout({children}) { return children; }
```

with `import "./globals.css";`

| element                                                           | owner after the change                                                          |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `<html lang dir className={fontVariables}>`                       | **`[locale]/layout.tsx`** — unchanged                                           |
| `<body className="font-sans antialiased">`                        | **`[locale]/layout.tsx`** — unchanged                                           |
| `NextIntlClientProvider`, `QueryProvider`, `generateStaticParams` | **`[locale]/layout.tsx`** — unchanged                                           |
| `<html>`/`<body>` for the 404                                     | **`app/not-found.tsx`** — kept, because the root layout renders none            |
| global stylesheet import                                          | **`app/layout.tsx`** (new) — and `[locale]/layout.tsx` keeps its own import too |

**Why this cannot produce two `<html>` or two `<body>`:** the root layout renders no tags at all, so on every path exactly one component in the chain renders a document — `[locale]/layout.tsx` for real routes, `app/not-found.tsx` for `/_not-found`. Measured (fact 17): `/en/login` stayed at 1 `<html>` / 2 CSS and `/en/nope` became 1 `<html>`.

**Why normal routes keep their styling:** `[locale]/layout.tsx` retains its own `globals.css` import, so its CSS association is untouched; the root layout's import is an addition, and Next deduplicates the bundle. Fact 17 confirms `/en/login` still linked **both** stylesheets.

**Watch item:** Next has a `missing-root-layout-tags` diagnostic for a root layout without `<html>`/`<body>`. The C-min build completed with only the pre-existing Sentry `global-error` warning and no such error. **Verify `pnpm build` stays clean** and treat any new warning as a blocker to re-plan, not something to suppress.

### D.2 — Locale resolution

**Use the existing infrastructure. No new negotiation system, no middleware change.**

Established from `next-intl@4.13.7`'s own `receiveRoutingConfig`:

- **Cookie name:** `NEXT_LOCALE` — next-intl's default, enabled by default (`localeCookie` defaults to `{name: "NEXT_LOCALE", sameSite: "lax"}`); neither app overrides it.
- **Format:** the bare locale string — `en` or `ar`. Confirmed live: `set-cookie: NEXT_LOCALE=en; Path=/; SameSite=lax`.
- **Locales / default:** `["en", "ar"]`, default `"en"`, `localePrefix` defaulting to `"always"`. Identical in both apps.
- **Guaranteed for unmatched routes?** Yes for every path the middleware matches — `/en/nope` and `/ar/nope` both do. Fact 18 proves it works **cold**, because the middleware sets the cookie on the _same_ request that renders the boundary.
- **Not guaranteed** for paths the matcher excludes — `api|_next|_vercel` and, importantly, **anything containing a dot** (`.*\..*`). Those reach the boundary with no cookie.

**Fallback:** validate with `hasLocale(routing.locales, value)` — the same helper `[locale]/layout.tsx` already uses — and fall back to `routing.defaultLocale` (`en`). A missing, empty or invalid cookie therefore yields the English 404, which is the current behaviour for every request today, so the fallback is a strict improvement over the status quo and never a regression.

**Middleware is not modified.** No change is required: the cookie already exists, with the right name, format and timing.

### D.3 — 404 copy source

**Reuse the existing catalogues. Do not duplicate strings.**

Verified present in **all four** catalogues (`apps/{web,portal}/messages/{en,ar}.json`):

| key                           | English          | Arabic                       |
| ----------------------------- | ---------------- | ---------------------------- |
| `common.notFound.title`       | "Page not found" | "الصفحة غير موجودة"          |
| `common.notFound.description` | present          | present                      |
| `common.backLinkLabel`        | "Go back home"   | "العودة إلى الصفحة الرئيسية" |

**Mechanism:** call `getTranslations({locale, namespace: "common"})` from `app/not-found.tsx`. This is an officially supported overload, and next-intl's own `GetRequestConfigParams` type documents this exact scenario:

> "If you provide an explicit locale to an async server-side function like `getTranslations({locale: 'en'})`, it will be passed via `locale` to `getRequestConfig`…"
> "**`undefined`**: The value can be `undefined` when a page outside of the `[locale]` segment renders."

**One blocking gap, found by inspection:** both apps' `src/i18n/request.ts` destructure **only** `requestLocale`. An explicit `getTranslations({locale: "ar"})` would therefore be **ignored**, `requestLocale` would be `undefined` outside `[locale]`, and the config would fall back to `en` — silently serving English on `/ar/nope`.

**Required change:** extend both `request.ts` files to honour the explicit `locale` param, preferring it over `requestLocale`. This is additive and inert for every existing caller (no current call passes an explicit locale), so normal routes are unaffected.

Note for a future story, not this one: `requestLocale` carries a `@deprecated` tag pointing at `next/root-params`. Out of scope.

### D.4 — `[locale]/not-found.tsx`

**Decision: keep it, correct its documentation, and re-scope its test. Do not delete it.**

Evidence, from Phase 0 rather than assumption — and the distinction you flagged between "unmatched route" and "descendant `notFound()`" turns out to be exactly right:

- **Unmatched routes never reach it** (fact 8) and will not after D either — they resolve to `/_not-found`, outside `[locale]`.
- **Descendant `notFound()` does reach it.** Experiment B and the isolation probe both rendered _this file_ — correct Arabic copy, correct `lang`/`dir` — when a page inside `[locale]` called `notFound()` (facts 14, 16). It is genuinely live code for that path.

So it is not dead; it is **unused**. Deleting it would mean any future `notFound()` inside `[locale]` falls back to the root boundary and loses the locale layout. Keeping it costs one file.

What must change:

1. Its doc comment claims it handles "the common case — a valid locale with an unmatched route". That is **false** and must be corrected to: it handles a descendant `notFound()` inside `[locale]`; unmatched routes are handled by the root boundary.
2. Its spec must not imply coverage of `/en/nope`.
3. Record the known limitation: if a descendant ever calls `notFound()`, this boundary renders with a **200** (fact 16). Document it; do not fix it here.

Likewise `[locale]/layout.tsx`'s own `notFound()` call is unreachable (fact 9) and its comment must be corrected.

---

## Implementation phases

### Phase 1 — `apps/web`

| file                                  | change                                                                                                                                                                                                                                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/app/layout.tsx`                  | **new** — root layout, `import "./globals.css"`, returns `children`, no document tags                                                                                                                                                                                                            |
| `src/i18n/request.ts`                 | honour the explicit `locale` param, preferring it over `requestLocale`                                                                                                                                                                                                                           |
| `src/app/not-found.tsx`               | resolve locale from `NEXT_LOCALE` (validated via `hasLocale`, fallback `defaultLocale`); set `<html lang dir>`; apply `fontVariables` + `font-sans antialiased` to match `[locale]/layout.tsx`; source copy via `getTranslations({locale, namespace: "common"})`; keep its own `<html>`/`<body>` |
| `src/app/[locale]/not-found.tsx`      | doc comment only                                                                                                                                                                                                                                                                                 |
| `src/app/[locale]/layout.tsx`         | doc comment only (its `notFound()` is unreachable)                                                                                                                                                                                                                                               |
| `src/app/not-found.spec.tsx`          | update for the new locale/copy behaviour                                                                                                                                                                                                                                                         |
| `src/app/[locale]/not-found.spec.tsx` | re-scope so it does not imply `/en/nope` coverage                                                                                                                                                                                                                                                |
| `src/test/not-found-css.spec.ts`      | **new** — build-artifact association check                                                                                                                                                                                                                                                       |

**Font detail, easy to miss:** the current root `not-found.tsx` renders `<body>` with no `font-sans` and no `fontVariables`, so today's 404 would fall back to a system font even once styled — Arabic especially. Applying both matches `[locale]/layout.tsx` and is required for criterion 4's typography to be genuinely correct.

### Phase 2 — `apps/portal`

Identical, file for file. The only differences: the back-link target (`/${locale}/home` vs `/${locale}/tickets`) and each app's own `messages/` directory. Both apps' `request.ts`, `routing.ts` and layouts are already byte-equivalent in the parts this story touches.

### Phase 3 — verification

Run the full matrix below against both apps before proposing a commit.

---

## Edge Cases & Failure Modes

- **Dot-containing paths bypass the middleware** (`.*\..*`), so `/foo.txt` reaches the root boundary with **no `NEXT_LOCALE` cookie**. Expected: `hasLocale` rejects `undefined` → `defaultLocale` → English 404, styled, 404 status. Probe one such path per app and record the result.
- **A tampered or stale cookie** (`NEXT_LOCALE=xx`) must not reach the message import. `hasLocale` is the guard; without it, `import('../../messages/xx.json')` would throw and turn a 404 into a 500.
- **`request.ts` regression risk.** Preferring `locale` over `requestLocale` changes a file every route depends on. It is inert today (no caller passes an explicit locale), but it must be proven so: the full web and portal suites plus a browser check of a real localised route in **both** locales.
- **Two documents.** If anyone later adds `<html>`/`<body>` to the root layout, every route renders two. The document-ownership test (below) is the guard.
- **Missing-root-layout diagnostic.** See D.1's watch item — a new build warning is a re-plan trigger, not something to suppress.
- **Metadata.** Neither app exports `metadata` or `generateMetadata` anywhere under `app/`, so there is none to preserve or relocate. Confirmed by grep.
- **`[locale]/not-found.tsx` still returns 200** when reached by a descendant `notFound()` (fact 16). Documented, not fixed.
- **jsdom proves none of this.** It cannot see HTTP status, routing, document ownership or CSS emission — which is why six passing boundary specs did not catch the original bug. The browser matrix is authoritative.

---

## Test Plan

Smallest additions that would actually have failed against the bug:

1. **Root layout document ownership** — assert `app/layout.tsx` renders its children and emits **no** `<html>` and **no** `<body>`. This is the guard against a future two-document regression.
2. **Locale resolution and fallback** — unit-test the cookie → locale mapping in isolation: `ar` → `ar`/`rtl`; `en` → `en`/`ltr`; **missing** → `en`/`ltr`; **invalid (`xx`)** → `en`/`ltr`. Keeping this logic in a tiny exported helper makes it testable without rendering.
3. **Localised copy source** — assert the root boundary renders `common.notFound.*` for the resolved locale, rather than hard-coded strings, for both `en` and `ar`.
4. **Build-artifact association** — assert `app-build-manifest.json` lists a `.css` entry for the 404 route. Its doc comment **must** state that this is _necessary but not sufficient_ — fact 3 proves association can coexist with zero emission — and point at the browser matrix as the real proof.
5. **Re-scope `[locale]/not-found.spec.tsx`** so nothing implies it covers `/en/nope`.
6. **All other existing tests pass unmodified.** Baselines at `29f6a40`: web **1282** / 86 files, portal **421** / 46 files, `@crm/ui` **312**.
7. **No new Playwright infrastructure.** The matrix below runs as a verification step.

---

## Verification

1. `pnpm --filter @crm/web test`, `pnpm --filter @crm/portal test`, `pnpm --filter @crm/ui test` (expect 312, unchanged — no shared package is touched).
2. `pnpm typecheck`, `pnpm lint`, `pnpm build` — and confirm **no new build warning**, especially none about root-layout tags.
3. **Forced rebuild before any browser measurement** — a cache-restored `.next` has already served a stale route once in this repository:
   `pnpm exec turbo run build --filter=@crm/web --filter=@crm/portal --force`

### Browser matrix — authoritative, both apps

| route                                         | assertions                                                                                                                                                                                                         |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/en/nope`                                    | **404**; exactly one `<html>`; exactly one `<body>`; ≥1 `<link rel="stylesheet">`; `h1` **24px / 600**; `lang="en"`, `dir="ltr"`; English copy; no overflow at **320** and **1440**                                |
| `/ar/nope`                                    | as above but `lang="ar"`, `dir="rtl"`, Arabic copy — **and run once from a COLD browser context with no pre-existing `NEXT_LOCALE` cookie**, to prove the middleware + boundary combination works on a first visit |
| `/en/login`                                   | **200**; `lang="en" dir="ltr"`; stylesheet count **2** as counted _by the browser_; `h1` 24px/600; no visual regression                                                                                            |
| a working **Arabic** route (e.g. `/ar/login`) | **200**; `lang="ar" dir="rtl"`; normal localised rendering                                                                                                                                                         |
| `/`                                           | **307** → `/en`                                                                                                                                                                                                    |
| `/nope`                                       | **307** → `/en/nope`                                                                                                                                                                                               |
| `/xx/tickets`                                 | **307** → `/en/xx/tickets`                                                                                                                                                                                         |
| one dot-path (e.g. `/foo.txt`)                | record status and locale; confirms the no-cookie fallback                                                                                                                                                          |

**Counting note:** count stylesheets via `document.querySelectorAll('link[rel="stylesheet"]').length` in the browser, **not** `grep -c` on the HTML — during Phase 0 a `grep -c` reported "1 stylesheet" on `/en/login` purely because both links sat on one line, and the browser showed 2. Use `document.documentElement.scrollWidth` vs `clientWidth` for overflow, never element right edges: under RTL the overflow extends left and a right-edge scan reports zero offenders.

**Byte-for-byte identity is explicitly not required** for working routes — build hashes and chunk names may legitimately change. The assertions above are the contract.

---

## Risks and rollback

| risk                                             | mitigation                                                                                                                                            |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root layout affects **every** route in both apps | It renders no tags and only adds a CSS import; fact 17 already measured `/en/login` unchanged. Full suites plus the working-route rows of the matrix. |
| `request.ts` is on every route's path            | The change is additive and inert for existing callers; proven by both full suites and a browser check of `/en/login` and `/ar/login`.                 |
| Cookie absent or tampered                        | `hasLocale` guard + `defaultLocale` fallback; unit-tested in all four states.                                                                         |
| Two-document regression later                    | Document-ownership test (Test Plan 1).                                                                                                                |
| Next diagnostic about a tag-less root layout     | Build must stay warning-free; otherwise stop and re-plan.                                                                                             |

**Rollback:** the whole story is one commit — two new files, one new spec, and small edits to five existing files per app, with no schema, dependency, middleware or shared-package change. `git revert` restores the previous behaviour exactly. Nothing is deleted, so there is no half-migrated state: `[locale]/not-found.tsx` is deliberately retained (D.4), and `app/not-found.tsx` keeps its own document, so reverting the root layout cannot leave a route without one.

---

## Done Criteria

- [ ] `/en/nope` and `/ar/nope` return **404** in both apps.
- [ ] Exactly one `<html>` **and** one `<body>` in the 404 response.
- [ ] At least one `<link rel="stylesheet">` in the 404 response.
- [ ] 404 `h1` computes to **24px / 600**.
- [ ] `/ar/nope` → `lang="ar" dir="rtl"` + Arabic copy, **including from a cold context with no cookie**.
- [ ] `/en/nope` → `lang="en" dir="ltr"` + English copy.
- [ ] 404 copy comes from `common.notFound.*` / `common.backLinkLabel`, not hard-coded strings.
- [ ] No horizontal overflow on the 404 at 320px or 1440px, either locale.
- [ ] `/en/login` 200, `lang="en" dir="ltr"`, **2** browser-counted stylesheets, no visual regression; a working Arabic route renders `lang="ar" dir="rtl"`.
- [ ] `/`, `/nope`, `/xx/tickets` keep their 307 targets; middleware untouched.
- [ ] `[locale]/not-found.tsx` retained with a corrected comment and a re-scoped test; `[locale]/layout.tsx`'s comment corrected.
- [ ] Root layout renders no `<html>`/`<body>`, guarded by a test.
- [ ] Locale fallback tested for missing and invalid cookie values.
- [ ] Build-artifact test present, labelled necessary-not-sufficient.
- [ ] `[locale]/error.tsx`, `global-error.tsx` and Sentry behaviour untouched; no new dependency.
- [ ] Both apps implemented and verified — no web-only fix.
- [ ] web / portal / ui suites, typecheck, lint and build green with no new warnings.
