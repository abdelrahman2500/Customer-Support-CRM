# Story intake

## Feature

- **Feature name (display):** Fix the unmatched-route 404 boundary
- **Feature slug (folder under `plans/`):** `fix-unmatched-route-not-found-boundary`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:**
- **Work item type:**
- **Status:**
- **Assignee:**
- **Labels:**

## Title

Fix the unmatched-route 404 boundary in both apps

## Description

A read-only recon at `29f6a40` established that an unmatched URL renders a broken 404 in **both** `apps/web` and `apps/portal`, identically.

Measured live:

| request | status | `<html>` | stylesheets | `lang`/`dir` |
| --- | --- | --- | --- | --- |
| `/en/login` (control) | 200 | 1 | 2 | `en`/`ltr` |
| `/en/nope` | 404 | **2** | **0** | `en`/`ltr` |
| `/ar/nope` | 404 | **2** | **0** | **`en`/`ltr`** |

Two distinct causes:

1. **Neither app has `app/layout.tsx`** — the document lives at `app/[locale]/layout.tsx`, inside the dynamic segment. For a route outside `[locale]`, Next 15.5.23 supplies its own document; `app/not-found.tsx` then renders a second `<html lang="en" dir="ltr">` inside it, producing two `<html>` elements.
2. **The stylesheet is associated but never emitted.** `app-build-manifest.json` maps `/_not-found/page` to the 31KB Tailwind bundle, yet the generated `_not-found.html` contains zero `stylesheet`/`.css` references. The page therefore renders unstyled and its `h1` falls back to the browser default 32px/700 regardless of Story 176's `text-title`.

Two consequences beyond "unstyled":

- **An Arabic user hitting a bad URL gets an English, LTR page.**
- **Both localised boundaries are dead code.** `[locale]/not-found.tsx` is unreachable because unmatched routes resolve to `/_not-found`, outside `[locale]`. `[locale]/layout.tsx`'s `notFound()` — the only `notFound()` call in either app — is unreachable because next-intl's middleware prefixes the default locale first (`/xx/tickets` → 307 → `/en/xx/tickets`).

This predates Story 176 and was not caused by its `text-title` change; the page would have been equally unstyled at `text-xl`.

## Acceptance criteria

1. `/en/nope` and `/ar/nope` return HTTP **404** in both apps.
2. The response contains exactly **one** `<html>` element.
3. The response contains at least one `<link rel="stylesheet">`.
4. The 404 `h1` computes to **24px** and **font-weight 600**, not the UA default.
5. `/ar/nope` renders `lang="ar" dir="rtl"` with Arabic 404 copy.
6. `/en/nope` renders `lang="en" dir="ltr"` with English 404 copy.
7. `/en/login` and representative working routes retain their current behaviour and rendering (build hashes may legitimately change).
8. `/`, `/nope` and `/xx/tickets` retain their current 307 redirect targets.
9. No unreachable not-found boundary is left without explicit documentation and a test proving why it exists.
10. No new dependency.
11. No change to the middleware matcher or locale-routing rules.
12. `[locale]/error.tsx`, `global-error.tsx`, Sentry warnings and unrelated error-boundary behaviour remain untouched.
13. No type-scale or visual redesign beyond restoring the intended 404 styling.
14. Both `apps/web` and `apps/portal` are covered by implementation and verification.

## Attachments

None.

## Dependencies

- **Blocked by / related ids:** None. Story 176 (`29f6a40`) is complete and pushed.
- **Depends on code areas or other stories:**

  - `apps/{web,portal}/src/app/not-found.tsx` — the root boundary, currently the only reachable 404.
  - `apps/{web,portal}/src/app/[locale]/not-found.tsx` — the localised boundary, currently unreachable.
  - `apps/{web,portal}/src/app/[locale]/layout.tsx` — owns `<html lang dir>`, `globals.css` and the unreachable `notFound()` call.
  - `apps/{web,portal}/src/middleware.ts` — read-only; its matcher and locale negotiation must not change.
  - Story 96 — created all four boundaries; two of its doc comments describe behaviour the recon disproved.
  - Story 176 — put the 404 `h1` on `text-title`; this story is what makes that visible.

## Extra notes

- Three candidate directions were identified during recon and **none may be assumed correct**: (A) keep the self-rendered root document and fix the dropped CSS link; (B) route unmatched paths through `[locale]` via a catch-all calling `notFound()`; (C) introduce a real root `app/layout.tsx`. The plan's Phase 0 requires build/runtime evidence before selecting.
- A manifest CSS association is **not** evidence of emission — the current build already proves the two can diverge.
- Direction A cannot satisfy criteria 5–6 alone: the root boundary sits outside `[locale]` and has no locale in scope.

## Technical hints

- Next **15.5.23**; runtime carries `__next_root_layout_boundary__` and `missing-root-layout-tags`.
- Middleware matcher `["/((?!api|_next|_vercel|.*\\..*).*)"]` — note the `.*\..*` exclusion: dot-containing paths bypass the middleware entirely and can still reach the root boundary.
- There is no catch-all route anywhere in either app today.
- Both apps are structurally identical; the only differences are the back-link target (`/${locale}/tickets` vs `/${locale}/home`) and each boundary's translation namespace.

## Testing requirements

- Browser/E2E verification is mandatory and authoritative — jsdom cannot see routing, document ownership, CSS emission or computed styles, which is why six passing boundary specs did not catch this.
- Smallest useful automated additions: a document-shape assertion on the reachable boundary, and a build-artifact assertion that the reachable 404 route carries a CSS entry (necessary, not sufficient).

## Out of scope

- `[locale]/error.tsx` and error-boundary behaviour.
- `global-error.tsx` and the Sentry global-error warning.
- The middleware matcher and locale negotiation.
- The `/` → `/en`, `/nope` → `/en/nope`, `/xx/tickets` → `/en/xx/tickets` redirects.
- Any visual redesign or copy change beyond what a localised 404 requires.
- New dependencies, tokens or primitives.
