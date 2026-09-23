# Story 173 — Make the agent workspace header safe below `sm`

---

## Prerequisites

- **Story 172** completed (`b13b35b`) — the HEAD this story starts from and the HEAD every measurement below was taken against. No code dependency.
- **Story 129** completed — split the old `workspace-nav.tsx` into `WorkspaceHeader` / `WorkspaceNavbar` / `WorkspaceSidebar`, and introduced the branding-driven brand block (`appName`, `logoUrl`, `primaryColor`) this story constrains.
- **Story 118** completed — the branch switcher, and the `twoMemberships` fixture in `workspace-header.spec.tsx` this story's tests extend.
- **Story RM-10 / RM-11** completed — made the _navigation_ responsive (`hidden … sm:flex` on both nav surfaces plus the header's own `sm:hidden` hamburger) and never returned for the header's identity/controls row. This story is that missing half.
- **Story 134** completed — the spacing token vocabulary (`--space-inline`), spent here as `gap-y-inline`.
- Precedent to match for tone and structure: [`../give-the-portal-csat-rating-the-aria-radio-group-keyboard-pattern/167-story-give-the-portal-csat-rating-the-aria-radio-group-keyboard-pattern.md`](../give-the-portal-csat-rating-the-aria-radio-group-keyboard-pattern/167-story-give-the-portal-csat-rating-the-aria-radio-group-keyboard-pattern.md) — a single-file frontend fix that applies an existing in-repo decision rather than inventing one, with a class-level guard where jsdom cannot reach.
- No coordination needed with any other owner: one production file and its spec are touched.

---

## Story Goal

Make the authenticated agent workspace header wrap instead of overflow, so the shell is safe at ≤320px in English and Arabic, including the multi-membership state, while remaining pixel-identical wherever the content already fits.

User-visible outcomes:

1. No horizontal page overflow on any authenticated agent route at 320px, EN or AR.
2. Every header control — signed-in identity, branch selector (when applicable), language selector, sign out — stays visible and operable below `sm`. Nothing is hidden.
3. The header reflows onto multiple rows when it must, instead of pushing sign-out off-screen.
4. Desktop and tablet are unchanged.

**Not in scope:** the portal header; `WorkspaceShell` / `<main>`; the navbar, sidebar or hamburger; branding fallback or `onError` handling; branding data cleanup; any new token or primitive; any Playwright infrastructure; API, RBAC or database work.

---

## Context — Read These Files First

1. `apps/web/src/components/workspace/workspace-header.tsx` — **the only production file this story changes**. Read **lines 179–246**, the whole returned header. The four elements to edit are: the `<header>` `className` at **line 183**, the brand `<img>` at **line 187**, the controls cluster `<div>` at **line 199**, and the identity `<span>` at **line 200**. Note also the branch switcher at **lines 201–224** (rendered only when `memberships.length > 1`), the `branchSwitchError` span at **lines 225–229**, the language `<select>` at **lines 230–241**, and the sign-out `Button` at **lines 242–244** — none of those five is edited.
   - **The intake's line numbers are each off by one or two** (it cites the `img` at ~186, the cluster at ~198, the span at ~199). The numbers in this plan were re-read at `b13b35b`; use these.
2. `apps/web/src/components/workspace/workspace-header.tsx` — **lines 189–197**, the text-brand `Link`. Its own comment at **lines 191–193** already states the principle this story generalises: `appName` "is still long enough to push the header's controls off-screen on a narrow viewport if left unbounded". The `<img>` at line 187 is the same hazard with no equivalent bound.
3. `apps/portal/src/components/portal/portal-header.tsx` — **line 174**, the precedent, read-only:
   `className="flex flex-wrap items-center justify-between gap-y-2 border-b-2 …"`. Its doc comment at **lines 63–68** records the identical finding ("no `flex-wrap` on either the header or the nav, so it genuinely overflowed the viewport at mobile widths"). **Do not copy its `hidden sm:flex`** — that sits on its `<nav>` at **line 214**, not on its controls cluster.
4. `apps/web/src/components/workspace/workspace-shell.tsx` — **lines 75–88**. The in-repo `min-w-0` precedent, with the reasoning written out: "a flex item's default `min-width: auto` refuses to shrink below its content's intrinsic width". That is exactly why the cluster and the identity span each need `min-w-0` here.
5. `apps/web/src/components/workspace/workspace-header.spec.tsx` — **lines 1–10** (imports; note `within` is already imported at line 2), **lines 35–44** (the `next/navigation` and `next-intl` mocks — the translation mock renders a key with vars as `` `${key}:${JSON.stringify(vars)}` ``, so the identity text asserts as `signedInAs:{"name":"Ada Lovelace"}`), **lines 92–100** (the `user` fixture), **lines 102–111** (the `branding()` helper), **lines 113–128** (`renderHeader()`), **lines 131–153** (the `beforeEach`, which defaults to a **single** membership), and **lines 487–510** (`describe("branch switcher (Story 118)")` and its `twoMemberships` fixture at **lines 499–510**).
6. `apps/web/src/components/workspace/workspace-sidebar.spec.tsx` — **lines 322–340**, `it("uses only logical-direction classes on every link")`. Copy this idiom for the direction guard, including the regex `/^(ml|mr|pl|pr|left|right|text-left|text-right)-/`.
7. `packages/config/tailwind-preset.js` — **lines 164–172**, the `spacing` scale. `inline` maps to `var(--space-inline)` (0.5rem), which is the token-compatible spelling of the portal's raw `gap-y-2`.
8. `packages/ui/src/components/button.tsx` — **line 25**, the cva base string containing `whitespace-nowrap`. **Do not override it.** It is why the row must wrap rather than compress.
9. Intake: `.squad/stories/make-the-agent-workspace-header-safe-below-sm/make-the-agent-workspace-header-safe-below-sm/intake.md`.

---

## Product rules (from story)

|                                       | Current behaviour                                             | New behaviour                                             |
| ------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------- |
| `<header>` row                        | `flex … justify-between`, **never wraps**                     | wraps, with a `--space-inline` row gap                    |
| Controls cluster                      | `flex items-center gap-4`, **never wraps**, `min-width: auto` | wraps, shrinkable (`min-w-0`), same 1rem column gap       |
| Identity `<span>`                     | wraps to multiple lines, cannot shrink below its longest word | single line, ellipsised, shrinkable to zero               |
| Brand `<img>`                         | `h-8 w-auto`, unbounded width                                 | capped below `sm`, **unbounded from `sm` up**             |
| Branch / language selectors, sign out | always visible                                                | **unchanged — still always visible**                      |
| Desktop (1440) and tablet (834)       | —                                                             | **pixel-identical**                                       |
| Page overflow at 320px                | EN 354 / AR 367 vs 320                                        | 320 = 320, EN and AR, with or without the branch switcher |

---

## Frontend Tasks

**No backend changes required.** No file under `apps/api`, no Prisma schema, no DTO, no migration, no `package.json`, no `pnpm-lock.yaml`, no token or preset change.

### Design decisions (read before editing)

1. **Four changes are required, not the three the intake lists.** The intake's implementation direction (header `flex-wrap` + cluster `min-w-0` + bounded image) was **measured insufficient** for acceptance criterion 3. With a branch switcher present, the cluster's own unshrinkable children (two `<select>`s + a `whitespace-nowrap` `Button` + three `gap-4` columns) exceed the available row width, so the cluster overflows _its own_ line. **`flex-wrap` on the controls cluster is the change that actually satisfies criterion 3.** See the measured table below.
2. **`min-w-0` and `truncate` must be applied together on the identity span.** `truncate` includes `white-space: nowrap`, which _raises_ a flex item's automatic minimum width to the full string. Adding `truncate` without `min-w-0` makes the overflow **worse**, not better.
3. **The logo cap is responsive, not absolute.** `max-w-32 sm:max-w-none` bounds it only where narrow-screen safety needs it and leaves the natural desktop presentation untouched, which is what the intake asks for. `max-w-32` resolves to **8rem** from Tailwind's own preserved numeric spacing scale (verified against the resolved theme), so it is not an arbitrary value.
4. **`gap-y-inline` alongside the existing `gap-4`.** Tailwind emits axis-specific gap utilities _after_ the `gap` shorthand (verified in the built stylesheet: `.gap-4` at byte offset 14029, `.gap-x-2` at 14167), so the row axis resolves to `--space-inline` while the column axis stays at the current 1rem. On an unwrapped row, row-gap has no effect at all — which is why desktop is unchanged.
5. **Nothing is hidden.** No `hidden`, no `sm:hidden`, no `sm:flex` is added to any control. That approach was trialled, works, and is rejected by the intake.

### Measured evidence for decision 1

Taken at 320×640 against a production build at `b13b35b`, signed in, with a branch switcher injected into the live DOM at its real position (133px wide — wider than the intake's ~100px estimate). Overflow is `documentElement.scrollWidth` vs `clientWidth` of 320:

| candidate                                    | EN        | AR        |
| -------------------------------------------- | --------- | --------- |
| baseline, switcher present                   | 446 ✗     | 516 ✗     |
| header `flex-wrap` + row gap only            | 446 ✗     | 459 ✗     |
| + cluster `min-w-0`, span `min-w-0`/truncate | 360 ✗     | 372 ✗     |
| **+ cluster `flex-wrap` + row gap**          | **320 ✓** | **320 ✓** |
| + logo cap                                   | 320 ✓     | 320 ✓     |

The logo cap does not change the multi-membership outcome; it is defence for a wide or broken image, which is what contributes 57px in the no-switcher case.

### 1 — The header row

**File: `apps/web/src/components/workspace/workspace-header.tsx`**

At **line 183**, add `flex-wrap` and `gap-y-inline` to the existing class string. Change only these two additions; leave the border, brand-primary variable, `bg-surface`, `px-6` and `py-3` exactly as they are:

```tsx
className =
  "flex flex-wrap items-center justify-between gap-y-inline border-b-2 border-[var(--brand-primary,rgb(var(--rule)))] bg-surface px-6 py-3";
```

### 2 — The controls cluster

**File: `apps/web/src/components/workspace/workspace-header.tsx`**

At **line 199**, add `min-w-0`, `flex-wrap` and `gap-y-inline`. Keep `gap-4` — it remains the column gap:

```tsx
<div className="flex min-w-0 flex-wrap items-center gap-4 gap-y-inline text-sm text-ink-muted">
```

This is the change that satisfies acceptance criterion 3. **Do not omit `flex-wrap` here** on the assumption that the header's own wrapping covers it — measured, it does not.

### 3 — The identity text

**File: `apps/web/src/components/workspace/workspace-header.tsx`**

At **line 200**, give the one genuinely elastic item its shrink treatment. Both classes, never one:

```tsx
<span className="min-w-0 truncate">{t("signedInAs", { name: user.fullName })}</span>
```

**Do not** add `truncate` without `min-w-0` (design decision 2). **Do not** move, rename or re-word the string, and **do not** add a `title` attribute — the full name stays in the text node, and adding a tooltip is a separate UX decision.

### 4 — The brand image

**File: `apps/web/src/components/workspace/workspace-header.tsx`**

At **line 187**, bound the image below `sm` only:

```tsx
<img
  src={branding.logoUrl}
  alt={brandName}
  className="h-8 w-auto max-w-32 object-contain sm:max-w-none"
/>
```

`object-contain` preserves aspect ratio while the cap is active. The `eslint-disable-next-line @next/next/no-img-element` comment at **line 186** stays. The text-brand `Link` branch at **lines 189–197** is **not** edited — it already carries `truncate`.

### 5 — No other production change

No edit to `WorkspaceShell`, `WorkspaceNavbar`, `WorkspaceSidebar`, the hamburger block, the realtime banner, `packages/ui`, `packages/config`, or any message catalogue. No new class is introduced beyond the seven named above.

---

## Edge Cases & Failure Modes

- **Branch switcher present (acceptance criterion 3).** Trigger: a user with `memberships.length > 1` (`workspace-header.tsx` line 201). Expected: no overflow at 320px. Enforced by `flex-wrap` on the cluster (task 2). Measured to fail at 360/372px without it — this is the single most likely way to ship a fix that passes a casual check and still misses the criterion.
- **`truncate` without `min-w-0`.** Trigger: applying task 3 partially. Expected and measured: the span's automatic minimum width becomes the full untruncated string, making the row _wider_ than before the fix. Both classes ship together or neither does.
- **`gap-y-inline` not taking effect over `gap-4`.** Trigger: a future Tailwind version reordering its gap utilities. Expected: the row gap between wrapped lines is 0.5rem. Confirmed by the byte ordering in the current built CSS (decision 4); if the browser verification shows a 1rem row gap instead, the fix still works — only the spacing is off — so treat it as cosmetic, not blocking.
- **A very long `fullName`.** Trigger: free-text user name. Expected: the identity text ellipsises rather than pushing controls off-screen. Enforced by task 3. The name remains fully available in the DOM text node for assistive technology.
- **A wide or broken logo.** Trigger: any `logoUrl`; today the dev database holds `https://example.com/logo-<uuid>.png`, which renders as a broken image occupying 57px. Expected: capped to 8rem below `sm`, unbounded from `sm` up. Enforced by task 4. **The broken URL itself is fixture data, not a product defect — do not add an `onError` fallback** (out of scope, and it is its own story).
- **`branchSwitchError` visible at the same time.** Trigger: a failed branch switch (`workspace-header.tsx` lines 225–229). That span is an additional flex child with no shrink treatment; with the cluster now wrapping, it takes its own line rather than widening the row. **Not separately measured** — verify it visually at 320px if the existing tests make the error state easy to reach; it is not a blocking criterion.
- **RTL measurement trap.** Under `dir="rtl"` the overflow extends to the **left**, so scanning for elements whose `right` edge exceeds the viewport reports **zero** offenders while `scrollWidth` is still 367. Any manual check must compare `scrollWidth` against `clientWidth`.
- **jsdom cannot see any of this.** No Tailwind CSS is loaded in the test environment, so a `scrollWidth` assertion there passes against the bug. This is why the Test Plan below is class-level and the real proof is the browser matrix — the same constraint already recorded in `packages/ui/src/lib/cn.spec.ts` and in Story 169's `Button` guard.

---

## Test Plan

All tests go in **`apps/web/src/components/workspace/workspace-header.spec.tsx`**. Add them as one new `describe("responsive header (Story 173)")` block placed after the existing `describe("branch switcher (Story 118)")` block (which ends before **line 615**). `within` is already imported at line 2; no new import is needed.

1. **Header wraps.** `renderHeader()`, then `container.querySelector("header")` has classes `flex-wrap` and `gap-y-inline`, and **not** `flex-nowrap`.
2. **Cluster is shrinkable and wraps.** The cluster is the `<header>`'s second element child. Assert it carries `min-w-0`, `flex-wrap` and `gap-y-inline`, and still carries `gap-4`. This is the guard for acceptance criterion 3 — the one a partial fix would fail.
3. **Identity text is the elastic item.** The span rendering `signedInAs:{"name":"Ada Lovelace"}` carries **both** `min-w-0` and `truncate`. Assert both in one test so a partial application cannot pass.
4. **Brand image is bounded below `sm` only.** `renderHeader({ branding: branding({ logoUrl: "https://example.com/logo.png" }) })`, then the `<img>` carries `max-w-32`, `object-contain` and `sm:max-w-none`, and still carries `h-8` and `w-auto`.
5. **Nothing is hidden — multi-membership presence.** Set `mockedUseMyBranchMembershipsQuery.mockReturnValue({ data: twoMemberships } as never)` (lift `twoMemberships` to module scope, or duplicate the fixture in the new block — do **not** modify the existing Story 118 tests). Then assert all four controls are present together: `getByLabelText("branchSwitcher.label")`, `getByLabelText("languageSwitcher.label")`, `getByText('signedInAs:{"name":"Ada Lovelace"}')`, and `getByRole("button", { name: "signOut" })`. Additionally assert none of them, nor the cluster, carries a `hidden` class. **This is the test that catches a "fix" implemented by hiding controls.**
6. **Direction safety.** Copy the idiom from `workspace-sidebar.spec.tsx` lines 322–340: walk every element under the `<header>` that has a `class` attribute and assert no class matches `/^(ml|mr|pl|pr|left|right|text-left|text-right)-/` and none matches `/^border-[lr]-/`.

**Do not modify** any of the ~40 existing tests in this file. They must pass unchanged; the header's sign-out, branch-switch, locale-switch, brand-block, hamburger and realtime-banner behaviour is untouched by this story.

**Deliberately not tested in jsdom:** overflow itself. There is no `scrollWidth` assertion anywhere in this plan's tests, because jsdom would return the same value before and after the fix.

---

## Verification Steps

1. **Frontend runs:** `pnpm --filter @crm/web test` from the repository root. Baseline at `b13b35b` is **86 files / 1266 tests**; expect 1266 + the six new cases, 0 failures.
2. **Regression:** `pnpm --filter @crm/portal test` (**414**) and `pnpm --filter @crm/ui test` (**312**), both expected **unchanged** — nothing outside `apps/web` is touched.
3. **Backend builds:** `pnpm typecheck`, then `pnpm lint`, then `pnpm build`, each from the repository root.
4. **Regression:** `apps/web/src/design-tokens.spec.ts` passes as part of step 1. Every class added is a token or a stock Tailwind utility; none is a raw `slate-*`/`white` palette class.
5. **Browser — the real proof.** Rebuild (`pnpm exec turbo run build --filter=@crm/web --force`; a cache-restored build has previously served a stale route), start `pnpm --filter @crm/api start` and `pnpm --filter @crm/web start`, sign in, and check **`document.documentElement.scrollWidth === document.documentElement.clientWidth`** at:
   - **320×640 EN** and **320×640 AR** — must be equal (before the fix: 354 and 367).
   - **834 EN/AR** and **1440 EN/AR** — must be equal, and the header must look unchanged.
     Compare `scrollWidth` to `clientWidth`, **not** element right edges (see Edge Cases).
6. **Browser — acceptance criterion 3.** The seeded admin has a single membership, so the switcher does not render. Exercise it **without creating unrelated data** by inserting a branch-switcher-sized `<select>` into the cluster from the devtools console and re-checking 320px EN and AR. If a multi-membership account already exists in the dev database, prefer that. **Do not seed a second membership for this check.**
7. **Regression — scope:** `git status --short` shows exactly **two** files: `workspace-header.tsx` and `workspace-header.spec.tsx`. Nothing under `apps/api`, `apps/portal`, `packages/**`, `messages/**`, `package.json` or the lockfile.
8. **Re-scan:** `grep -nE '\b(ml|mr|pl|pr|text-left|text-right)-' apps/web/src/components/workspace/workspace-header.tsx` returns no match outside doc comments.

---

## Done Criteria

- [ ] `<header>` (line 183) carries `flex-wrap` and `gap-y-inline`; border, `px-6`, `py-3` and the brand-primary variable are unchanged.
- [ ] The controls cluster (line 199) carries `min-w-0`, `flex-wrap` and `gap-y-inline`, and keeps `gap-4`.
- [ ] The identity span (line 200) carries **both** `min-w-0` and `truncate`.
- [ ] The brand `<img>` (line 187) carries `max-w-32 object-contain sm:max-w-none` and keeps `h-8 w-auto`.
- [ ] At 320×640, `scrollWidth === clientWidth` in **EN** and in **AR**.
- [ ] The same holds with a branch switcher present.
- [ ] Signed-in identity, branch selector, language selector and sign out are all present and operable below `sm`; no `hidden`/`sm:hidden` class was added to any of them.
- [ ] At 834 and 1440, EN and AR, the header is visually unchanged.
- [ ] No physical-direction utility introduced; the new direction-safety test passes.
- [ ] `Button`'s `whitespace-nowrap` is not overridden anywhere.
- [ ] No new token, primitive, dependency or translation key; no `packages/**` or `apps/portal` change.
- [ ] All existing `workspace-header.spec.tsx` tests pass unmodified; none weakened, skipped or deleted.
- [ ] web / portal / ui suites, typecheck, lint and build green; diff limited to two files.
