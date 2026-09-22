# Story 161 — Standardize query-state accessibility without forcing a visual redesign

---

## Prerequisites

- **Story S-4** — `QueryStateCard`, whose loading branch already has the correct semantics, and whose spec pins both halves of them.
- **Story S-2/S-4** — `Skeleton` (not `aria-hidden`), `SkeletonText`/`SkeletonCard` (both `aria-hidden` on their wrapper).
- **Story S-7 / 155** — the `data === undefined` protection: a failed *background* refetch must not replace rendered rows with an error state.

---

## Story Goal

Give the 24 hand-rolled loading branches the accessibility `QueryStateCard`
already has, while leaving every one of them looking exactly as it does now.

**Not in scope:** the 12 partial ladders, empty-state redesign, `SkeletonText`
adoption, error-copy changes, `QueryStateCard`'s visuals, backend, API,
permissions, query configuration.

---

## Premise, measured at HEAD `de73049`

**24** complete contiguous ladders, **18** files. `role="status"`: 0.
`aria-busy`: 0. `aria-hidden`: 0. Bare `<Skeleton>`: 24. `SkeletonText`: 0.

Verified at the primitive, not assumed: `Skeleton` spreads props onto a plain
`div` and sets no `aria-hidden`; only `SkeletonText`/`SkeletonCard`/
`RouteLoadingSkeleton` hide themselves. So all 24 leave placeholder boxes in
the tree and announce nothing.

Placeholder shapes: **14** a single bare `Skeleton`; **10** a
`flex flex-col gap-2` stack of 2–5 bars.

---

## Design decisions

### 1 — Option A: separate the behaviour from the composition

`LoadingStatus` is added to `@crm/ui`:

```tsx
<div role="status" aria-busy="true" aria-label={label}>   // announced once
  <div aria-hidden="true" class={className}>{children}</div>   // placeholder
</div>
```

`className` lands on the **placeholder**, not the status wrapper, so a caller's
existing `flex flex-col gap-2` keeps applying to the element that directly
contains its bars. The status wrapper is an unstyled block, which is why
inserting it moves nothing: at every one of the 24 sites the loading branch is
already a single child of either a block container (14, mostly `SectionCard`)
or a `flex-col` one (10), and it stays a single child of both.

`aria-hidden` cannot sit on the live region itself without hiding what is being
announced — which is exactly why `QueryStateCard` nests the two, and why this
does too.

### 2 — `QueryStateCard` consumes it

Its loading branch becomes `<LoadingStatus label={loadingLabel} className={className}>`.
This is the test of the extraction: a primitive pulled out of another primitive
that then cannot use it was pulled out wrongly. **All 23 existing
`QueryStateCard` tests must pass unchanged** — no test may be adjusted to fit.

### 3 — `asChild` for the 14 single-element placeholders

A bar stack already has a wrapper element for `LoadingStatus` to become. A lone
`Skeleton` does not, and wrapping it would add an element for nothing.
`asChild` makes the caller's own `Skeleton` the hidden placeholder, using the
same Radix `Slot` mechanism `Card` and `Button` already use.

### 4 — `common.loading`, not 24 new strings

All nine existing `QueryStateCard` consumers pass `tCommon("loading")`. The key
exists in both apps and both locales. Following that convention means **no new
i18n keys**, no invented per-panel copy, and no key-parity risk.

### 5 — Nothing else moves

Error branches keep their `Alert variant="destructive"`, their copy, their
retry. Empty branches keep their compact `<p>`. Content rendering is not
touched. No query option changes, so Story S-7/155's `data === undefined`
protection is untouched by construction — this story only ever edits the
`isLoading` branch.

---

## Frontend Tasks

No backend changes required.

### 1 — `packages/ui`

Add `loading-status.tsx` + spec; export both from `src/index.ts`; delegate
`QueryStateCard`'s loading branch to it.

### 2 — The 10 stack sites

`LoadingStatus` replaces the wrapper `div`, carrying its exact `className`.
Children untouched.

### 3 — The 14 single-`Skeleton` sites

Wrap in `<LoadingStatus label={...} asChild>`; the `Skeleton`'s own classes stay
on the `Skeleton`.

### 4 — Labels

`const tCommon = useTranslations("common")` where a file does not already have
one, placed inside the component that renders the branch.

---

## Edge Cases & Failure Modes

- **The hook lands in the wrong component.** Several of these files hold two or
  three components; `useTranslations` must go in the one that renders the
  branch. A misplaced hook is a compile error at the use site, so typecheck
  catches it — it did, once, during the pilot.
- **An extra wrapper in a `flex-col` parent.** 10 of the 24 sit in one. The
  loading branch is a single flex item before and after, so the gap between it
  and its siblings is unchanged; only its inner structure gains a level.
- **`asChild` onto a component that does not forward props.** `Skeleton`
  spreads `...props` onto its `div`, so the merge works; this is asserted
  directly in the primitive's spec rather than assumed.
- **Double announcement.** Two live regions in one branch would announce twice;
  the spec asserts exactly one `role="status"` per loading state.
- **Announcing a background refetch.** This branch renders on `isLoading` only
  — a first load — so a refetch with data on screen announces nothing, which is
  the correct behaviour and preserves S-7.

---

## Test Plan

1. **`LoadingStatus` spec** — labelled single live region with `aria-busy`;
   placeholder `aria-hidden`; `className` on the placeholder and the status
   wrapper left unstyled; `asChild` merges onto the caller's element without
   adding one; accessible name is the label, never the placeholder.
2. **`QueryStateCard` spec, unchanged** — all 23 must pass as written.
3. **Consumer tests, one per placeholder shape** — the stack case
   (`tasks-panel`) asserts the announcement, exactly one region, the
   placeholder's original classes and a bar count unchanged at 3; the
   `asChild` case (`attachments-card`) asserts no wrapper was added and the
   `Skeleton` kept its own classes.
4. **Every existing suite unchanged** — web, portal and ui at their current
   counts, plus only the new tests.

---

## Verification Steps

1. `pnpm --filter @crm/ui test` — baseline **252**.
2. `pnpm --filter @crm/web test` — baseline **1206**.
3. `pnpm --filter @crm/portal test` — baseline **358**.
4. Guards: both `design-tokens.spec.ts`, `table-mobile-labels.spec.ts`,
   `fetch-state-messages.spec.ts`.
5. `pnpm typecheck`, `pnpm lint`, `pnpm build`.
6. Re-run the ladder scan: sites with `role="status"` must be **24/24**, and
   `SkeletonText` adoption must still be **0** — the second number is the proof
   no placeholder was redesigned.
7. Diff review: only `packages/ui`, the 18 consumer files and their specs.

---

## Done Criteria

- [ ] `LoadingStatus` exists in `@crm/ui`, spec'd, exported.
- [ ] `QueryStateCard` renders through it; its 23 tests pass unchanged.
- [ ] All 24 branches announce once and hide their placeholder.
- [ ] Placeholder classes, bar counts and sizes identical at all 24.
- [ ] No empty state, error branch, skeleton shape or query option changed.
- [ ] No new i18n key; no physical-direction utility; no raw palette class.
- [ ] ui / web / portal suites, typecheck, lint, build green, no test weakened.
