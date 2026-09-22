# query-state-accessibility — plan overview

Entry point for the **query-state-accessibility** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN  | File | Title | Tracker id | Depends on |
|-----|------|-------|------------|------------|
| 161 | [161-story-standardize-query-state-accessibility.md](./161-story-standardize-query-state-accessibility.md) | Standardize query-state accessibility without forcing a visual redesign | 161 | Story S-4 (`QueryStateCard`), Story S-2/S-4 (`Skeleton`/`SkeletonText`) |

## Dependency notes

Story S-4 built `QueryStateCard` and, with it, the correct semantics for a
loading state: a labelled `role="status"` region with an `aria-hidden`
placeholder. Story 160's recon measured that 24 hand-rolled ladders across 18
files have neither half.

### The architectural decision, stated once

The obvious move — point all 24 at `QueryStateCard` — is the wrong one. Its
loading branch renders `SkeletonText` and its empty branch renders
`EmptyState`'s dashed block, where these sites render placeholders sized to
the panel they precede (a chat-height bar, three table rows, one SLA line) and
compact paragraph empty states. Adopting it wholesale would be a 24-screen
visual redesign bought to fix an accessibility bug.

So the **behaviour was separated from the composition**: `LoadingStatus` in
`@crm/ui` is the labelled-live-region-plus-hidden-placeholder shape on its own,
and `QueryStateCard` now renders its own loading branch through it. That
consumption is the test that the extraction is right — a primitive extracted
out of another primitive that then cannot use it has been extracted wrongly.
All 23 of `QueryStateCard`'s existing tests pass against the delegated version,
unchanged.

### Why `asChild`

Two placeholder shapes exist among the 24: a single bare `Skeleton` (14 sites)
and a `flex flex-col gap-2` bar stack (10). A stack already has a wrapper
element that `LoadingStatus` can become, carrying its exact classes. A lone
`Skeleton` does not, and wrapping it would add an element for nothing.
`asChild` — the same Radix mechanism `Card` and `Button` already use for
exactly this reason — makes the caller's own `Skeleton` the hidden placeholder
instead.

### What is deliberately not done

No empty state is redesigned, no skeleton becomes `SkeletonText`, no error copy
changes, no query configuration is touched. The 12 partial/distributed ladders
are out of scope: they are missing branches or spread across a component, and
each is a judgement rather than a repetition.
