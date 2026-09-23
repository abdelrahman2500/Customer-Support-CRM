# Story 176 — Align error and not-found page titles with the type scale

---

## Prerequisites

- **Story 175** completed (`ef36416`) — HEAD only, no code dependency.
- **Story 170** completed (`919da8c`) — established `text-title` as the page-title step, and the rule that `font-semibold` is dropped beside it because the step's own `fontSize` tuple declares `fontWeight: 600`. This story applies that same decision to the six files 170 did not reach.
- **Story 134** — defined the scale in `packages/config/tailwind-preset.js`.

---

## Story Goal

Bring the last six page titles onto the named type scale, so the product renders page titles at one size instead of two.

**Not in scope:** page copy, links, layout, landmarks, the `error.tsx` retry behaviour, any other scale step, new tokens/primitives/dependencies.

---

## Context — Read These Files First

1. The six files, each a single `<h1 className="text-xl font-semibold text-ink">`:
   - `apps/web/src/app/not-found.tsx` — **line 24**
   - `apps/web/src/app/[locale]/error.tsx` — **line 43**
   - `apps/web/src/app/[locale]/not-found.tsx` — **line 22**
   - `apps/portal/src/app/not-found.tsx` — **line 15**
   - `apps/portal/src/app/[locale]/error.tsx` — **line 35**
   - `apps/portal/src/app/[locale]/not-found.tsx` — **line 17**
2. `packages/ui/src/components/page-header.tsx` — **~lines 14–26**, Story 170's own record of this decision: why `text-title`, and why `font-semibold` goes.
3. `apps/web/src/app/not-found.spec.tsx` — the only existing spec that renders an affected page; the new assertion goes here.

---

## Product rules (from story)

| | Current | New |
|---|---|---|
| The six error/not-found `h1`s | `text-xl font-semibold text-ink` (1.25rem) | `text-title text-ink` (1.5rem/600) |
| Every other page title | `text-title` | **unchanged** |
| Page copy, links, layout, landmarks | — | **unchanged** |

---

## Frontend Tasks

**No backend changes required.**

### 1 — The six headings

In each of the six files, replace exactly:

```
className="text-xl font-semibold text-ink"
```

with:

```
className="text-title text-ink"
```

Change nothing else in any of them — not the copy, not the surrounding shell, not the links.

### 2 — One focused test

**File: `apps/web/src/app/not-found.spec.tsx`**

Add an assertion that the rendered `h1` carries `text-title` and **not** `text-xl`. The negative half is what makes it a regression test.

---

## Edge Cases & Failure Modes

- **The root `not-found.tsx` files carry hard-coded English copy** ("Page not found") because they render outside the `[locale]` segment where `next-intl` has no request config. That is pre-existing and deliberate; **do not** attempt to localise them here.
- **`error.tsx` is not reachable by navigation** — it renders only on a thrown render error, so the browser check covers the not-found pages and the error pages ride on the identical one-class change.
- **A longer Arabic title at the larger size** could wrap where it previously did not. These shells are centred with generous padding and no adjacent actions, so wrapping is harmless; confirm visually in AR.
- **jsdom cannot measure the rendered size** — the assertion is class-level, the same constraint recorded in `cn.spec.ts` and Stories 169/173/174.

---

## Test Plan

1. **`apps/web/src/app/not-found.spec.tsx`** — assert the `h1` has `text-title`, and does not have `text-xl`.
2. No other spec changes; the remaining five files have no specs and this is the same single-class edit.
3. All existing tests pass unmodified.

---

## Verification Steps

1. **Frontend runs:** `pnpm --filter @crm/web test` and `pnpm --filter @crm/portal test`.
2. **Regression:** `pnpm --filter @crm/ui test` — expected unchanged at 312.
3. **Backend builds:** `pnpm typecheck`, `pnpm lint`, `pnpm build`.
4. **Browser:** visit an unknown path in each app, EN and AR, and confirm the heading computes to **24px** with `font-weight: 600`.
5. **Re-scan:** `grep -rn "text-xl\|text-lg" apps/web/src apps/portal/src --include=*.tsx | grep -v spec` returns only doc-comment prose.
6. **Scope:** `git status --short` shows the six files, the one spec, and this story's plan artifacts.

---

## Done Criteria

- [ ] All six `h1`s render `text-title text-ink`.
- [ ] No `font-semibold` beside `text-title` on those elements.
- [ ] No production `text-xl`/`text-lg` heading remains in either app.
- [ ] Copy, links, layout and landmarks unchanged on all six pages.
- [ ] The not-found heading measures 24px / 600 in a browser, EN and AR.
- [ ] Existing tests pass; one focused assertion added.
- [ ] web / portal / ui suites, typecheck, lint and build green.
