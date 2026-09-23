# Story 165 — Announce early-return query loading states

---

## Prerequisites

- **Story 161** — `LoadingStatus` (`role="status"`, `aria-busy`, labelled, `aria-hidden` placeholder, `asChild`).
- **Story 162** — `placeholderHidden`, and the guard this story extends.
- **Story 97** — the three shared detail skeletons, and `RouteLoadingSkeleton`'s recorded decision that a route transition does not announce.

---

## Story Goal

Announce the nine loading states written as early returns, and give the two
`ArticleDetailSkeleton`s the `aria-hidden` their siblings have.

**Not in scope:** Story 164's controls, raw status enums, the 6 raw
status-palette usages, navigation, `FormField`, Card/SectionCard,
`QueryStateCard`, tokens, backend, RBAC, route-level `loading.tsx`
announcements, skeleton visual redesign.

---

## Premise, measured at HEAD `d8bf185`

9 early returns, all `isLoading`, all component-level, 0 mutations. 4 render an
inline placeholder; 5 return a shared detail skeleton, of which 3 already
self-hide and 2 gain `aria-hidden` here.

---

## Design decisions

### 1 — The announcement goes at the call site

Five of the nine return a component that route-level `loading.tsx` also
renders. Putting `LoadingStatus` inside the skeleton would make route
transitions announce, contradicting a decision the codebase recorded on
purpose. Wrapping at the call site leaves the skeleton presentational and the
route path untouched — verified: 0 `loading.tsx` files changed, and all five
still render their skeleton with no `LoadingStatus`.

### 2 — `placeholderHidden` per site, not uniformly

`{false}` for the five self-hiding skeletons, so the wrapper does not duplicate
an `aria-hidden` that is already on the skeleton's root. `asChild` for the two
lone `Skeleton` returns, adding no element. Default for the two inline stacks,
whose bare bars hide nothing by themselves.

### 3 — `common.loading`, again

The key all 44 existing `LoadingStatus` callers already pass, present in EN and
AR in both apps. **No new i18n key.**

### 4 — One guard, two arms

The same invariant expressed in two syntaxes belongs in one detector. The
early-return arm accepts any `<…Skeleton` because that is what these branches
return, and is bounded by the `if`'s own indentation.

---

## Edge Cases & Failure Modes

- **Announcing a route transition.** The whole reason for decision 1. A
  sensitivity case asserts an unconditional `return <TicketDetailSkeleton />`
  is not matched.
- **A mutation mistaken for a query.** The opener requires a `…Query`
  receiver; asserted with a `saveMutation.isPending` case.
- **Duplicated `aria-hidden`.** Decision 2; the tests assert the wrapper adds
  none where the skeleton already hides itself.
- **`asChild` onto a component that forwards no props.** `TicketDetailSkeleton`
  and friends take no props, so `asChild` is *not* used for them —
  `placeholderHidden={false}` is, which needs no prop forwarding.
- **A skeleton changing visually from `aria-hidden`.** It cannot; the tests
  additionally pin the wrapper classes and bar counts.

---

## Test Plan

1. One test per early return (8 files, 9 sites): `role="status"`, `aria-busy`,
   the accessible label, the placeholder's hiding, and unchanged bar counts.
2. Two direct tests that `ArticleDetailSkeleton` is `aria-hidden`, keeps its
   classes and bars, and renders **no** `role="status"` on its own — which is
   also the route-level path's assertion.
3. Guard sensitivity: the early-return defect in both placeholder shapes is
   flagged; both announced compositions, the route-level return and a mutation
   pending state are not.
4. Every existing suite unchanged.

---

## Verification Steps

1. `pnpm --filter @crm/web test` — baseline **1221**.
2. `pnpm --filter @crm/portal test` — baseline **363**.
3. `pnpm --filter @crm/ui test` — **258**, expected unchanged.
4. Both `design-tokens.spec.ts`, plus the mobile-table, fetch-state and enum guards.
5. `pnpm typecheck`, `pnpm lint`, `pnpm build`.
6. EN/AR parity exact; no new physical-direction utility, raw neutral palette, unnamed control or raw enum.
7. Re-scan: 0 early-return states without an announcement.

---

## Done Criteria

- [ ] All 9 early returns announce, at the call site.
- [ ] 0 `loading.tsx` files touched; route-level behaviour unchanged.
- [ ] Both `ArticleDetailSkeleton`s `aria-hidden`, no visual change.
- [ ] `placeholderHidden` chosen per site.
- [ ] No query, mutation, routing, RBAC or backend change; no `isLoading` → `isPending`.
- [ ] Guard extended (not duplicated), 0 offenders, sensitivity proven.
- [ ] web / portal / ui suites, typecheck, lint, build green; no test weakened.
