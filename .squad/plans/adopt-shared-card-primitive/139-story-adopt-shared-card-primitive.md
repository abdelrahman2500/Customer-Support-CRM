# Story 139 — Adopt the shared Card primitive

---

## Prerequisites

- **Story S-3** created `packages/ui/src/components/card.tsx`. Its doc comment states it exists "to replace the `rounded-md border border-slate-200 bg-white p-4` string that the recon counted hand-written in 44 files" — that replacement never happened. This story performs it.
- **Story S-1 / Story 134** — the token layer. `--radius-surface: 0.375rem` and `--space-surface: 1rem` are exposed by `packages/config/tailwind-preset.js` as `rounded-surface` and `p-surface`, and match `rounded-md`/`p-4` exactly.
- **Story 135** is the precedent for a per-file primitive-adoption sweep with a guard.

---

## Story Goal

Route every true content surface in both apps through the existing `Card`, so surface styling has one definition, and spend the Story 134 radius/spacing tokens inside the primitive.

**Zero visual change is the bar.** Every token substituted resolves to the identical value the inline string already used.

---

## Context — Read These Files First

1. `packages/ui/src/components/card.tsx` — the whole file. Note `cardVariants` is `rounded-md border border-rule bg-surface` with a `flat`/`raised` elevation variant, and that padding lives on the sections, not on `Card`.
2. `packages/config/tailwind-preset.js` — `borderRadius` (`surface`/`inner`/`pill`) and `spacing` (`tight`/`inline`/`stack`/`surface`/`shell`/`field-x`/`field-y`).
3. `packages/config/tailwind-tokens.css` lines ~191–220 — the values. `--radius-surface: 0.375rem` is annotated "matches rounded-md"; `--space-surface: 1rem` is annotated as the `p-4` card padding.
4. `apps/web/src/components/dashboard/dashboard-view.tsx` ~lines 240, 315 — representative surfaces, each a `<div>` wrapping an `<h2 className="text-sm font-semibold text-ink">`.
5. `apps/portal/src/components/portal/portal-home-view.spec.tsx` ~lines 111–117 — asserts headings at **level 1 and level 2**. This is why `CardTitle` (an `h3`) is out of scope.

---

## Design decisions

### 1 — `<Card className="p-surface">`, not `<Card><CardContent>`

The primitive's doc suggests the two-element shape. This story uses the one-element shape instead, deliberately:

- It introduces **no new DOM node** at 56 sites, so `.closest()` selectors, heading structure and every existing test are untouched.
- It achieves the actual goal — one definition of border/radius/surface — identically.
- Adding 56 wrapper divs for no user-visible benefit would be markup churn, not improvement.

`CardHeader`/`CardContent`/`CardFooter` remain available for screens that later need real header/footer composition.

### 2 — `CardTitle` is not used

`CardTitle` renders `<h3>`. 37 of the migrated surfaces currently open with `<h2>`, and `portal-home-view.spec.tsx` asserts `level: 2`. Switching would regress the document outline and break tests. Headings stay exactly as they are.

### 3 — What is NOT a Card

Verified by enumerating every distinct class string containing `border border-rule bg-surface`:

| String | Count | Verdict |
|---|---|---|
| `rounded-md border border-rule bg-surface p-4` | 51 | **migrate** |
| `flex flex-col gap-3 … p-4` | 2 | **migrate**, keep layout classes |
| `grid grid-cols-1 gap-4 … p-4 sm:grid-cols-2 lg:grid-cols-4` | 2 | **migrate**, keep layout classes |
| `flex flex-wrap items-end gap-2 … p-3` | 1 | **migrate**, keep `p-3` |
| `w-full max-w-sm rounded-lg … p-8 [text-center] shadow-sm` | 8 | **leave** — auth/error page shell, deliberately `rounded-lg`/`p-8` |
| `pointer-events-auto … p-3 shadow-md` | 1 | **leave** — toast |
| `absolute top-full z-10 … py-1 shadow-md` | 1 | **leave** — dropdown panel |
| `… bg-surface-sunk px-3 py-2` | 2 | **leave** — inline notice, not a surface |

### 4 — Primitive improvement, strictly token-for-token

`cardVariants` base becomes `rounded-surface border border-rule bg-surface`; `raised` becomes `shadow-resting`; section padding becomes `p-surface` (and `px-surface py-stack` on the footer). Each substitution resolves to the value already in use.

---

## Implementation tasks

### 1 — Token-ise the primitive

**File: `packages/ui/src/components/card.tsx`**

- `cardVariants` base: `rounded-md` → `rounded-surface`.
- `raised`: `shadow-sm` → `shadow-resting`.
- `CardHeader`: `p-4 pb-0` → `p-surface pb-0`.
- `CardContent`: `p-4` → `p-surface`.
- `CardFooter`: `px-4 py-3` → `px-surface py-stack`.
- Extend the doc comment to record that Story 139 performed the adoption S-3 anticipated, and why the one-element shape was chosen.

### 2 — Migrate the surfaces

Replace the opening element and its matching close, in both apps:

```tsx
// before
<div className="rounded-md border border-rule bg-surface p-4"> … </div>
// after
<Card className="p-surface"> … </Card>
```

Layout-carrying variants keep their layout classes: `<Card className="flex flex-col gap-3 p-surface">`, `<Card className="grid grid-cols-1 gap-4 p-surface sm:grid-cols-2 lg:grid-cols-4">`, `<Card className="flex flex-wrap items-end gap-2 p-3">`.

The one `<section className="rounded-md border border-rule bg-surface p-4">` becomes `<Card className="p-surface">` — `Card` renders a `div`; confirm no CSS or test depends on that element being a `section`.

Add `Card` to each file's existing `@crm/ui` import.

### 3 — Guard

**File: `apps/web/src/design-tokens.spec.ts`** and **`apps/portal/src/design-tokens.spec.ts`**

Add a focused assertion that the literal `border border-rule bg-surface` no longer appears in production `.tsx`, with the same comment-line skip the existing tests use. Prove it fails by reintroducing the string, then revert.

---

## Edge Cases & Failure Modes

- **Nested surfaces.** Some cards contain inner bordered blocks; only the outer string matches the target, and the migration is string-exact, so inner blocks are untouched.
- **Matching the closing tag.** The replacement must pair each opening `<div>` with its own `</div>`, not the first one found. Use depth tracking, and verify with typecheck + build (an unbalanced JSX tree fails to compile).
- **`<section>` → `<div>`.** One site. Purely presentational here; verify no spec queries it by tag.
- **Heading levels unchanged** — no `CardTitle`, so `h2` stays `h2`.
- **RTL.** `Card` adds no direction-sensitive utility. The zero-physical-direction count must stay at 0 in both apps.
- **Auth shells look similar but are not cards** — `rounded-lg p-8 shadow-sm`, centred, page-level. Migrating them would change radius and padding, i.e. a visual redesign. Out of scope.

---

## Test Plan

1. **Existing suites are the primary safety net** — web, portal and `packages/ui` must pass unmodified. No spec may be weakened.
2. **Card's own spec** (`packages/ui/src/components/card.spec.tsx`) must pass; extend only if it asserts literal `rounded-md`/`p-4` strings that the token swap changes.
3. **Guard tests** in both `design-tokens.spec.ts`, proven falsifiable then reverted.
4. **Inventory**: `border border-rule bg-surface` count goes 70 → 14 (the 8 auth shells + toast + dropdown + 2 notices + 2 sunk variants), and `rounded-md border border-rule bg-surface p-4` goes 51 → 0.

---

## Verification Steps

1. **Baseline:** record current counts for `pnpm --filter @crm/web test`, `@crm/portal test`, `@crm/ui test`.
2. `pnpm --filter @crm/ui test`
3. `pnpm --filter @crm/web test`
4. `pnpm --filter @crm/portal test`
5. `pnpm typecheck` — this is what catches an unbalanced JSX tree.
6. `pnpm lint`
7. `pnpm build`
8. **Inventory greps** per Test Plan item 4.
9. **RTL:** `grep -rnE '\b(ml|mr|pl|pr|text-left|text-right)-[0-9a-z]+'` over both `src` trees must stay **0**.
10. **Scope:** `git status --short` lists only `packages/ui/src/components/card.tsx`, the two `design-tokens.spec.ts`, the migrated app files, and the story/plan artifacts. No backend, no schema, no migration.

---

## Done Criteria

- [ ] `Card` uses `rounded-surface` / `shadow-resting` / `p-surface` / `px-surface py-stack`.
- [ ] 56 true surfaces render through `<Card>`; layout classes preserved.
- [ ] Zero `rounded-md border border-rule bg-surface p-4` remain in either app.
- [ ] Auth shells, toast, dropdown panel and inline notices are untouched.
- [ ] No DOM node added; no heading level changed; no `CardTitle` used.
- [ ] Both token guards gain the surface-string assertion, proven falsifiable.
- [ ] Zero physical-direction utilities in either app.
- [ ] `packages/ui`, web, portal, typecheck, lint, build all green with no spec weakened.
