# query-loading-accessibility — plan overview

Entry point for the **query-loading-accessibility** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File | Title | Tracker id | Depends on |
|-----|------|-------|------------|------------|
| 162 | [162-story-standardize-remaining-query-loading-accessibility.md](./162-story-standardize-remaining-query-loading-accessibility.md) | Standardize remaining query loading accessibility | 162 | Story 161 (`LoadingStatus`) |

## Dependency notes

Story 161 built `LoadingStatus` and applied it to the 24 complete four-branch
ladders, deliberately deferring the partial and distributed ones. Those carry
the identical defect, so this finishes the job and closes it with a guard.

### What made this one different

161's 24 sites turned out uniform. These 19 did not, and classifying them
before touching anything is what surfaced the two that needed judgement:

- **`reports-view`'s `ReportCardSkeleton`** is a local component taking only
  `variant`, so it cannot receive `asChild`'s merged props. The fix went
  *inside* it — it already owns a wrapper `div` in both variants — rather than
  wrapping it from outside, which would have added two elements to say one
  thing. No API change; just composition in the right place.
- **The portal's notification history** renders a real `Table` with the real
  column headers the populated table will use, and already marks only its
  `TableBody` `aria-hidden` so those headers stay announced. `LoadingStatus`
  always hid its whole placeholder, so using it here would have deleted content
  the screen deliberately kept. That is a demonstrated limitation, and the one
  place this story changes the primitive.

### The one API addition

`placeholderHidden` (default `true`). One boolean, one call site, covered by
its own spec. It exists because a placeholder is not always wholly decorative —
not to make an awkward call site compile.

### The guard, and what it cannot do

A source guard is justified here because it can be made narrow enough to be
reliable: it fires only on a `*Query.isLoading/isPending` opener whose branch
contains a bare `<Skeleton>` and no shared primitive. Against the current tree
that is 0 offenders across 47 query loading branches, with the other ~100
`Skeleton` usages — route fallbacks, detail skeletons, mutation pending states,
`SkeletonText` consumers — correctly untouched.

It earned its place before it was even committed: written as a probe, it found
the 19th site that the story's own recon window had missed.

Its one accepted blind spot is documented in the guard itself: a placeholder
rendered through a local component holds its accessibility one indirection
away, which a source scan cannot follow without resolving components across
files and flagging legitimate code. Component specs cover that case.
