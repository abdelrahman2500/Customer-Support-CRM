# Story 162 — Standardize remaining query loading accessibility

---

## Prerequisites

- **Story 161** — `LoadingStatus` in `@crm/ui` (`role="status"`, `aria-busy`, labelled, `aria-hidden` placeholder, `asChild`), and `QueryStateCard` delegating its loading branch to it.
- **Story S-2/S-4** — `Skeleton` (not `aria-hidden`) vs `SkeletonText`/`SkeletonCard` (both hide themselves).
- **Story S-7 / 155** — the `data === undefined` protection during background refetch failures.

---

## Story Goal

Give every remaining genuine query loading state the same announcement, with no
change to how any of them looks.

**Not in scope:** navigation, cards, tokens, dark mode, i18n architecture,
backend, API, RBAC, routing, unrelated refactoring, and **any mutation pending
state**.

---

## Premise, measured at HEAD `3c35f50`

**19** genuine query loading branches render a skeleton with no live region —
the 18 from Story 161's recon plus one its scan window was too narrow to see.
**0** are mutation pending states: every one was classified by locating its
declaration, and all 19 resolve to a `use*Query` hook. `isPending` appears at 7
of them and is TanStack v5's first-load flag on a query, not a mutation's.

| Shape | Count | Treatment |
|---|---|---|
| `group` | 9 | `LoadingStatus` becomes the existing wrapper `div`, carrying its className |
| `single` | 8 | `LoadingStatus asChild` onto the `Skeleton` — no element added |
| `indirect` (`ReportCardSkeleton`) | 1 | applied inside the local component |
| `partly meaningful` (portal notification history) | 1 | `placeholderHidden={false}` |

---

## Design decisions

### 1 — `LoadingStatus` everywhere, in whichever position is correct

The two shapes Story 161 established cover 17 of 19 unchanged. The value of
classifying first was the other two, where the naive application is wrong.

### 2 — `reports-view`: fix inside the placeholder, not around it

`ReportCardSkeleton({ variant })` does not forward props, so `asChild` has
nothing to merge onto. Wrapping it from the call site would add a status
wrapper *and* an `aria-hidden` div around a component that already owns its own
wrapper. It already renders `<div className="mt-2 flex flex-col gap-1">` in
both variants, so `LoadingStatus` becomes that div and the component takes a
`label`. No API change — just putting the composition where the element already
is.

### 3 — Portal notification history: the one demonstrated API limitation

Its placeholder is a real `Table` whose column headers are the same real
headers the populated table will use, and it already marks only its
`TableBody` `aria-hidden` — with a comment saying exactly why. `LoadingStatus`
unconditionally hid its whole placeholder, so applying it as-is would have
removed those headers from the accessibility tree: a regression, traded for an
announcement.

So `LoadingStatus` gains **one boolean**, `placeholderHidden` (default `true`).
The default is unchanged for all 18 other sites and for every Story 161 caller.
This is the only change to the primitive, and it exists because a placeholder
is genuinely not always decorative — not to make an awkward call site compile.

### 4 — `common.loading`, again

The same key all `QueryStateCard` and Story 161 callers pass. No new i18n key,
no invented per-panel copy, no key-parity risk.

### 5 — A guard is justified here

Unlike a blanket "every `Skeleton` needs a `LoadingStatus`" rule — which would
flag route fallbacks, detail skeletons and mutation pending states — a guard
scoped to *a query loading branch containing a bare `Skeleton`* is precise. It
reports 0 offenders across 47 query loading branches while leaving the other
~100 `Skeleton` usages alone.

Its blind spot is stated in the guard's own doc comment: an indirect
placeholder (decision 2) keeps its accessibility one indirection away, which a
source scan cannot follow. Component specs cover that.

---

## Frontend Tasks

No backend changes required.

1. **`packages/ui`** — add `placeholderHidden` to `LoadingStatus`; extend its spec.
2. **9 group sites** — `LoadingStatus` replaces the wrapper `div` with its exact className.
3. **8 single sites** — `LoadingStatus asChild` around the `Skeleton`.
4. **`reports-view`** — `ReportCardSkeleton` takes `label` and renders through `LoadingStatus` in both variants.
5. **Portal notification history** — `LoadingStatus … placeholderHidden={false}` replaces the `overflow-x-auto` wrapper; the `TableBody aria-hidden` stays exactly as it is.
6. **Guards** — add the query-loading guard to both apps' `design-tokens.spec.ts`.

---

## Edge Cases & Failure Modes

- **A hook inserted into a multi-line parameter list.** This bit Story 161 once. The insertion now tracks paren depth and only accepts a body brace at depth 0 — the failure mode is a compile error, so typecheck catches it either way.
- **Mutation pending mistaken for query loading.** Every branch was classified from its declaration; 0 mutations were touched, and the guard's own sensitivity spec asserts a `saveMutation.isPending` branch is not flagged.
- **Announcing a background refetch.** No loading condition is edited — a diff of every `isLoading`/`isPending` flag before and after is identical. `audit-log-view`'s own comment already records that `isPending` fires only on a genuine first load.
- **Hiding real content.** Decision 3's whole point; asserted by a spec that the real column header survives and the placeholder rows do not.
- **CRLF files.** One portal file uses CRLF; transforms split on `/\r?\n/` and rejoin with the file's own terminator.

---

## Test Plan

1. **`LoadingStatus` spec** — the existing five, plus `placeholderHidden={false}` keeping a real `columnheader` announced while the caller's own `aria-hidden` still covers the rows.
2. **Three pilots, one per shape** — `ai-settings-view` (group, `isLoading`, whole-panel), `audit-log-view` (group, `isPending`), `ticket-ai-card` (single, `asChild`). Each asserts the announcement, exactly one status region, the placeholder's original classes, and an unchanged bar count.
3. **Guard sensitivity** — fires on both defect shapes; silent on `LoadingStatus`, `asChild`, a hand-written `role="status"`, a standalone `Skeleton`, a mutation pending state, a `SkeletonText` placeholder and a commented-out branch.
4. **Every existing suite unchanged.**

---

## Verification Steps

1. `pnpm --filter @crm/ui test` — baseline **257**.
2. `pnpm --filter @crm/web test` — baseline **1207**.
3. `pnpm --filter @crm/portal test` — baseline **358**.
4. Both `design-tokens.spec.ts`, `table-mobile-labels.spec.ts`, `fetch-state-messages.spec.ts`.
5. `pnpm typecheck`, `pnpm lint`, `pnpm build`.
6. Re-scan: 0 unannounced query loading branches repo-wide, under a wide window and any query naming.
7. Diff: 0 `SkeletonText`, 0 `EmptyState`, 0 `QueryStateCard` added; every `<Skeleton>` element byte-identical; every loading condition byte-identical.

---

## Done Criteria

- [ ] All 19 branches announce through `LoadingStatus`; scan reports 0 remaining.
- [ ] `placeholderHidden` added, defaulted `true`, used at exactly one site, spec'd.
- [ ] No skeleton, empty state, error state, layout or surrounding card changed.
- [ ] No query option, condition, mutation, permission, route or backend change.
- [ ] Guard added to both apps, 0 offenders, with sensitivity coverage.
- [ ] ui / web / portal suites, typecheck, lint, build green, no test weakened.
