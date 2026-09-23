# early-return-loading-accessibility — plan overview

Entry point for the **early-return-loading-accessibility** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File | Title | Tracker id | Depends on |
|-----|------|-------|------------|------------|
| 165 | [165-story-announce-early-return-query-loading-states.md](./165-story-announce-early-return-query-loading-states.md) | Announce early-return query loading states | 165 | Story 161 (`LoadingStatus`), Story 162 (the guard this extends) |

## Dependency notes

Stories 161 and 162 announced every `{q.isLoading && ...}` JSX loading branch —
43 of them — and left a guard that scans exactly that shape. Nine loading
states are written as `if (q.isLoading) return ...` instead, so neither the
stories nor the guard ever saw them. This closes that form and extends the
guard to cover it.

### The constraint that shaped the whole story

Five of the nine return the *same component* a route-level `loading.tsx`
renders. The obvious fix — put `LoadingStatus` inside `TicketDetailSkeleton` —
would have made every route transition announce as well, contradicting
`RouteLoadingSkeleton`'s recorded decision that App Router's own focus
management already handles that case.

So the announcement goes at the **call site**. The skeletons stay purely
presentational, and no `loading.tsx` file was touched. A sensitivity case pins
this directly: an unconditional `return <TicketDetailSkeleton />` — the route
form — is not matched by the guard.

### `placeholderHidden`, decided per site

- The five returning a shared detail skeleton pass `placeholderHidden={false}`,
  because that skeleton carries `aria-hidden` on its own root. Letting the
  wrapper add a second would duplicate an attribute that is already correct.
- The two single-`Skeleton` returns use `asChild`, so the `Skeleton` itself
  becomes the hidden placeholder and no element is added.
- The two inline bar stacks keep the default, replacing their wrapper `div`
  and carrying its exact classes.

### `ArticleDetailSkeleton`

Both apps' copies lacked the `aria-hidden` their two siblings always had — an
inconsistency independent of the announcements, and one that also affected the
route-level path. Fixed in the skeleton itself, which is where it belongs, and
verified to change nothing visually.

### Guard: extended, not duplicated

The Story 162 detector gained a second arm rather than a second guard, because
it is the same invariant: *a query loading state that shows a placeholder
announces itself*. The early-return arm accepts any `<…Skeleton` component, not
just a bare `<Skeleton`, since that is what these branches return. It cannot
match a route-level `loading.tsx` (which returns unconditionally) or a mutation
(the opener requires a `…Query` receiver), and both exclusions are asserted.
